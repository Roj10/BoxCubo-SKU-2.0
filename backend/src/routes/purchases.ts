import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

const PRODUCTS = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE'] as const
type Product = (typeof PRODUCTS)[number]

const PRODUCT_LABELS: Record<Product, string> = {
  BOXCUBO_V2: 'BoxCubo V2',
  SLIM: 'Slim',
  VISION: 'Vision',
  EYE: 'EYE',
}

// Lê as quantidades de máquinas da query string (?BOXCUBO_V2=10&SLIM=5...)
function parseQuantities(query: Record<string, unknown>): Partial<Record<Product, number>> {
  const quantities: Partial<Record<Product, number>> = {}
  for (const p of PRODUCTS) {
    const n = Number(query[p])
    if (Number.isFinite(n) && n > 0) quantities[p] = Math.floor(n)
  }
  return quantities
}

interface PurchaseItem {
  material_id: string
  name: string
  unit: string
  quantity: number // total necessário (soma de receita × qtd de máquinas)
  price: number | null
  purchase_link: string | null
  subtotal: number | null
  breakdown: { product_type: Product; machines: number; per_machine: number; via?: string }[]
}

const MAX_DEPTH = 6

// Agrega as receitas dos produtos pedidos numa lista única de compras.
// Subconjuntos fabricados internamente não entram na lista: são "explodidos"
// nos materiais da receita deles (BOM multinível), recursivamente.
async function buildPurchaseList(quantities: Partial<Record<Product, number>>): Promise<PurchaseItem[]> {
  const products = Object.keys(quantities) as Product[]
  const bomItems = await prisma.bomItem.findMany({
    where: { product_type: { in: products } },
    include: { material: true },
  })

  const byMaterial = new Map<string, PurchaseItem>()

  const addNeed = (
    material: { id: string; name: string; unit: string; price: number | null; purchase_link: string | null },
    perMachine: number,
    product: Product,
    machines: number,
    via?: string
  ) => {
    let entry = byMaterial.get(material.id)
    if (!entry) {
      entry = {
        material_id: material.id,
        name: material.name,
        unit: material.unit,
        quantity: 0,
        price: material.price,
        purchase_link: material.purchase_link,
        subtotal: null,
        breakdown: [],
      }
      byMaterial.set(material.id, entry)
    }
    entry.quantity += perMachine * machines
    entry.breakdown.push({ product_type: product, machines, per_machine: perMachine, ...(via ? { via } : {}) })
  }

  // Explode um subconjunto fabricado nos seus componentes (quantidades por máquina)
  const explode = async (
    parentId: string,
    parentName: string,
    perMachine: number,
    product: Product,
    machines: number,
    depth: number,
    seen: Set<string>
  ) => {
    const components = await prisma.bomItem.findMany({
      where: { parent_material_id: parentId },
      include: { material: true },
    })
    for (const c of components) {
      const need = c.quantity * perMachine
      if (c.material.manufactured && depth < MAX_DEPTH && !seen.has(c.material_id)) {
        const next = new Set(seen)
        next.add(c.material_id)
        await explode(c.material_id, c.material.name, need, product, machines, depth + 1, next)
      } else {
        addNeed(c.material, need, product, machines, parentName)
      }
    }
  }

  for (const item of bomItems) {
    const product = item.product_type as Product
    const machines = quantities[product] ?? 0
    if (item.material.manufactured) {
      await explode(item.material_id, item.material.name, item.quantity, product, machines, 1, new Set([item.material_id]))
    } else {
      addNeed(item.material, item.quantity, product, machines)
    }
  }

  const items = [...byMaterial.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  for (const item of items) {
    // Evita ruído de ponto flutuante em quantidades fracionadas (ex: 0.30000000000000004)
    item.quantity = Math.round(item.quantity * 1000) / 1000
    item.subtotal = item.price != null ? Math.round(item.price * item.quantity * 100) / 100 : null
  }
  return items
}

// GET / — lista de compras agregada para as quantidades pedidas
router.get('/', async (req, res) => {
  try {
    const quantities = parseQuantities(req.query as Record<string, unknown>)
    if (Object.keys(quantities).length === 0) {
      return res.json({ quantities, items: [], total: 0, missing_price: 0 })
    }
    const items = await buildPurchaseList(quantities)
    const total = Math.round(items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0) * 100) / 100
    const missing_price = items.filter((i) => i.price == null).length
    res.json({ quantities, items, total, missing_price })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /export.csv — exporta a lista de compras em CSV (Excel pt-BR: separador ";")
router.get('/export.csv', async (req, res) => {
  try {
    const quantities = parseQuantities(req.query as Record<string, unknown>)
    if (Object.keys(quantities).length === 0) {
      return res.status(400).json({ error: 'Informe a quantidade de pelo menos um produto.' })
    }
    const items = await buildPurchaseList(quantities)
    const total = items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0)

    const escape = (v: string | number) => {
      const s = String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    // Números com vírgula decimal para o Excel pt-BR reconhecer como valor
    const num = (n: number) => String(n).replace('.', ',')
    const money = (n: number) => n.toFixed(2).replace('.', ',')

    const resumo = (Object.entries(quantities) as [Product, number][])
      .map(([p, q]) => `${PRODUCT_LABELS[p]}: ${q}`)
      .join(' · ')

    const header = ['Material', 'Unidade', 'Quantidade', 'Preço unitário (R$)', 'Subtotal (R$)', 'Link de compra']
    const lines = items.map((i) =>
      [
        i.name,
        i.unit,
        num(i.quantity),
        i.price != null ? money(i.price) : '',
        i.subtotal != null ? money(i.subtotal) : '',
        i.purchase_link ?? '',
      ]
        .map(escape)
        .join(';')
    )
    const totalLine = ['TOTAL', '', '', '', money(total), ''].map(escape).join(';')

    const csv =
      '﻿' +
      [
        escape(`Lista de Compras — ${resumo}`),
        '',
        header.join(';'),
        ...lines,
        totalLine,
      ].join('\r\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="lista-de-compras.csv"')
    res.send(csv)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
