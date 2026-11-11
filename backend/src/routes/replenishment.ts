import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { materialNeeds, toBuy, PRODUCTS, PRODUCT_LABELS, type Product } from '../lib/stockTargets'
import { buildCsv, csvMoney, csvNum, sendCsv } from '../lib/csv'

// Reposição: materiais abaixo do estoque mínimo. O mínimo vem de "manter
// material para N máquinas" de cada produto, multiplicado pela receita.
const router = Router()

export async function replenishment() {
  const { minMachines, needs } = await materialNeeds()
  const materials = await prisma.material.findMany({ include: { suppliers: { orderBy: { position: 'asc' } } } })
  const lines = []
  for (const m of materials) {
    const minimum = needs.get(m.id)?.minimum ?? 0
    const buy = m.manufactured ? 0 : toBuy(minimum, m.current_stock, m.unit)
    if (buy <= 0) continue
    const principal = m.suppliers[0]
    lines.push({
      material_id: m.id, sku: m.sku, name: m.name, unit: m.unit,
      current: m.current_stock, minimum, buy,
      price: m.price, cost: m.price != null ? Math.round(buy * m.price * 100) / 100 : null,
      supplier: principal?.name ?? null, supplier_code: principal?.code ?? null,
      other_suppliers: m.suppliers.slice(1).map((s) => s.name),
      products: needs.get(m.id)?.products ?? [],
    })
  }
  // agrupado por fornecedor principal (sem fornecedor por último), depois SKU/nome
  lines.sort((a, b) =>
    (a.supplier ?? '￿').localeCompare(b.supplier ?? '￿') || (a.sku ?? a.name).localeCompare(b.sku ?? b.name))
  return {
    targets: minMachines,
    lines,
    total_cost: Math.round(lines.reduce((s, l) => s + (l.cost ?? 0), 0) * 100) / 100,
    without_price: lines.filter((l) => l.price == null).length,
    zeroed: lines.filter((l) => l.current <= 0).length,
  }
}

// GET / — lista de reposição
router.get('/', async (_req, res) => {
  try {
    res.json(await replenishment())
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /export.csv — a lista em planilha, separada por fornecedor
router.get('/export.csv', async (_req, res) => {
  try {
    const r = await replenishment()
    const rows = r.lines.map((l) => [
      l.supplier ?? 'Sem fornecedor', l.supplier_code ?? '', l.sku ?? '', l.name, l.unit,
      csvNum(l.current), csvNum(l.minimum), csvNum(l.buy), csvMoney(l.price), csvMoney(l.cost),
    ])
    rows.push(['', '', '', '', '', '', '', '', 'Total', csvMoney(r.total_cost)])
    const csv = buildCsv(
      ['Fornecedor', 'Código no fornecedor', 'SKU', 'Material', 'Unidade', 'Estoque', 'Mínimo', 'Comprar', 'Preço unit.', 'Custo'],
      rows
    )
    sendCsv(res, 'reposicao.csv', csv)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /targets — { product_type, min_machines }: manter material para N máquinas
router.put('/targets', async (req, res) => {
  try {
    const { product_type, min_machines, actor } = req.body ?? {}
    if (!(PRODUCTS as readonly string[]).includes(product_type)) return res.status(400).json({ error: 'Produto inválido.' })
    const n = Number(min_machines)
    if (!Number.isInteger(n) || n < 0 || n > 10000) return res.status(400).json({ error: 'Informe um número inteiro de máquinas.' })
    await prisma.productStockTarget.upsert({
      where: { product_type },
      update: { min_machines: n },
      create: { product_type, min_machines: n },
    })
    await logAudit(prisma, {
      entity_type: 'Material', entity_id: `minimo-${product_type}`, action: 'UPDATE', actor: actor || 'Sistema',
      summary: `Estoque mínimo: materiais para ${n} ${PRODUCT_LABELS[product_type as Product]}`,
    })
    res.json(await replenishment())
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
