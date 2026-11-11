import express, { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { applyStockMovement } from '../lib/stockMovements'
import { materialNeeds } from '../lib/stockTargets'

const router = Router()

const LOW_STOCK_RATIO = 0.2 // alerta quando estoque atual <= 20% do estoque cheio

// Anexa campos calculados (percentual e flag de baixo estoque) a um material
function withStatus(m: { current_stock: number; full_stock: number; rack?: { number: number } | null; rack_level?: number | null; rack_box?: number | null } & Record<string, unknown>) {
  const percent = m.full_stock > 0 ? Math.round((m.current_stock / m.full_stock) * 100) : 0
  const low = m.full_stock > 0 && m.current_stock <= m.full_stock * LOW_STOCK_RATIO
  return { ...m, percent, low, location: locationLabel(m.rack, m.rack_level, m.rack_box) }
}

// Localização no almoxarifado: "E1-P2-C3" (estante 1, prateleira 2, caixa 3)
export function locationLabel(rack: { number: number } | null | undefined, level: number | null | undefined, box?: number | null): string | null {
  if (!rack) return null
  let s = `E${rack.number}`
  if (level) s += `-P${level}`
  if (level && box) s += `-C${box}`
  return s
}

// Localização vinda da tela: { rack_id, level, box } ou null (sem lugar).
// Confere se a estante existe e se a prateleira e a caixa cabem nela.
async function parseLocation(value: unknown): Promise<{ data?: { rack_id: string | null; rack_level: number | null; rack_box: number | null }; error?: string }> {
  if (value === undefined) return {}
  if (value === null || typeof value !== 'object' || !(value as { rack_id?: unknown }).rack_id) {
    return { data: { rack_id: null, rack_level: null, rack_box: null } }
  }
  const { rack_id, level, box } = value as { rack_id: unknown; level?: unknown; box?: unknown }
  const rack = typeof rack_id === 'string'
    ? await prisma.storageRack.findUnique({ where: { id: rack_id }, include: { shelves: true } })
    : null
  if (!rack) return { error: 'Estante não encontrada.' }
  const lv = level === null || level === undefined || level === '' ? null : Number(level)
  if (lv !== null && (!Number.isInteger(lv) || lv < 1 || lv > rack.levels)) {
    return { error: `A estante E${rack.number} tem prateleiras de P1 a P${rack.levels}.` }
  }
  const bx = lv === null || box === null || box === undefined || box === '' ? null : Number(box)
  if (bx !== null) {
    const boxes = rack.shelves.find((s) => s.level === lv)?.boxes ?? 0
    if (!Number.isInteger(bx) || bx < 1 || bx > boxes) {
      return { error: boxes ? `A prateleira E${rack.number}-P${lv} tem caixas de C1 a C${boxes}.` : `A prateleira E${rack.number}-P${lv} não tem caixas.` }
    }
  }
  return { data: { rack_id: rack.id, rack_level: lv, rack_box: bx } }
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'string' ? Number(value) : (value as number)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// Preço e link são opcionais: null/'' limpa o campo, valor válido atualiza
function sanitizePrice(value: unknown): number | null {
  if (value === null || value === '') return null
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : (value as number)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// SKU: GRUPO-CLASSE-FINAL em maiúsculas, só letras/números separados por hífen
// (ex: ELE-RES-10, EST-PAR-M4X10). Vazio = sem SKU.
const SKU_FORMAT = /^[A-Z0-9]+(-[A-Z0-9]+){2,}$/
function parseSku(value: unknown): { sku: string | null; error?: string } {
  if (value === null || value === undefined) return { sku: null }
  if (typeof value !== 'string') return { sku: null, error: 'SKU inválido.' }
  const sku = value.trim().toUpperCase()
  if (!sku) return { sku: null }
  if (sku.length > 40 || !SKU_FORMAT.test(sku)) {
    return { sku: null, error: 'SKU deve ter o formato GRUPO-CLASSE-FINAL, ex: ELE-RES-10.' }
  }
  return { sku }
}

// Prisma P2002 = valor repetido em campo único (aqui, o SKU)
function isUniqueError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
}

// Fornecedores vindos da tela: [{ name, code }]. Tira vazios e repetidos;
// a ordem é a da lista (o primeiro é o principal).
function parseSuppliers(value: unknown): { name: string; code: string | null }[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  const out: { name: string; code: string | null }[] = []
  for (const s of value) {
    const name = typeof s?.name === 'string' ? s.name.trim().slice(0, 120) : ''
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const code = typeof s?.code === 'string' && s.code.trim() ? s.code.trim().slice(0, 120) : null
    out.push({ name, code })
  }
  return out
}

const withSuppliers = {
  suppliers: { orderBy: { position: 'asc' as const } },
  rack: { select: { id: true, number: true, levels: true } },
}

// Quem está editando (o sistema não tem login): obrigatório para salvar o cadastro
function parseActor(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : null
}
const ACTOR_REQUIRED = 'Informe quem está editando o material.'

function sanitizeLink(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s ? s.slice(0, 2000) : null
}

// GET / — lista todos os materiais (com percentual e flag de baixo estoque),
// o estoque mínimo (da Reposição) e em quais produtos cada um é usado
router.get('/', async (_req, res) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { name: 'asc' }, include: withSuppliers })
    const { needs } = await materialNeeds()
    res.json(materials.map((m) => {
      const n = needs.get(m.id)
      return { ...withStatus(m), minimum: m.manufactured ? 0 : n?.minimum ?? 0, products: n?.products ?? [] }
    }))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /export.csv — exporta o estoque de materiais em CSV
router.get('/export.csv', async (_req, res) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { name: 'asc' }, include: { rack: true } })
    const header = ['SKU', 'Material', 'Localização', 'Unidade', 'Origem', 'Estoque Atual', 'Estoque Cheio', '% Estoque', 'Status']
    const escape = (v: string | number) => {
      const s = String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = materials.map((m) => {
      const { percent, low } = withStatus(m)
      return [
        m.sku ?? '',
        m.name,
        locationLabel(m.rack, m.rack_level, m.rack_box) ?? '',
        m.unit,
        m.manufactured ? 'Fabricado' : 'Comprado',
        m.current_stock,
        m.full_stock,
        `${percent}%`,
        low ? 'BAIXO' : 'OK',
      ]
        .map(escape)
        .join(';')
    })
    const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="estoque-materiais.csv"')
    res.send(csv)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST / — cria um material
router.post('/', async (req, res) => {
  try {
    const { name, sku, unit, current_stock, full_stock, price, purchase_link, manufactured, suppliers, actor, location } = req.body ?? {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório.' })
    }
    const editor = parseActor(actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    const parsedSku = parseSku(sku)
    if (parsedSku.error) return res.status(400).json({ error: parsedSku.error })
    const supplierList = parseSuppliers(suppliers) ?? []
    const loc = await parseLocation(location)
    if (loc.error) return res.status(400).json({ error: loc.error })
    const initialStock = sanitizeNumber(current_stock)
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.material.create({
        data: {
          name: name.trim(),
          sku: parsedSku.sku,
          unit: typeof unit === 'string' && unit.trim() ? unit.trim() : 'un',
          current_stock: 0,
          full_stock: sanitizeNumber(full_stock),
          price: sanitizePrice(price),
          purchase_link: sanitizeLink(purchase_link),
          manufactured: manufactured === true,
          ...(loc.data ?? {}),
          suppliers: { create: supplierList.map((s, i) => ({ ...s, position: i })) },
          edited_by: editor,
          edited_at: new Date(),
        },
      })
      await logAudit(tx, {
        entity_type: 'Material', entity_id: created.id, action: 'CREATE', actor: editor,
        summary: `Material cadastrado: ${created.sku ? `${created.sku} · ` : ''}${created.name}`,
      })
      // o estoque inicial entra como movimentação (aparece no histórico)
      if (initialStock > 0) {
        await applyStockMovement(tx, {
          type: 'AJUSTE', actor: editor, note: 'Estoque inicial do cadastro',
          changes: [{ material_id: created.id, quantity: initialStock }],
        })
      }
      return tx.material.findUniqueOrThrow({ where: { id: created.id }, include: withSuppliers })
    })
    res.status(201).json(withStatus(material))
  } catch (e) {
    if (isUniqueError(e)) return res.status(409).json({ error: 'Já existe um material com este SKU.' })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id — atualiza um material (nome, unidade, estoque atual/cheio, fabricado)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, sku, unit, current_stock, full_stock, price, purchase_link, manufactured, suppliers, actor, location } = req.body ?? {}
    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Material não encontrado.' })
    const editor = parseActor(actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })

    const data: Record<string, unknown> = { edited_by: editor, edited_at: new Date() }
    if (typeof name === 'string' && name.trim()) data.name = name.trim()
    if (sku !== undefined) {
      const parsedSku = parseSku(sku)
      if (parsedSku.error) return res.status(400).json({ error: parsedSku.error })
      data.sku = parsedSku.sku
    }
    if (typeof unit === 'string' && unit.trim()) data.unit = unit.trim()
    // estoque atual NÃO é gravado direto: a diferença vira uma movimentação "Ajuste"
    const newStock = current_stock !== undefined ? sanitizeNumber(current_stock, existing.current_stock) : existing.current_stock
    if (full_stock !== undefined) data.full_stock = sanitizeNumber(full_stock, existing.full_stock)
    if (price !== undefined) data.price = sanitizePrice(price)
    if (purchase_link !== undefined) data.purchase_link = sanitizeLink(purchase_link)
    const loc = await parseLocation(location)
    if (loc.error) return res.status(400).json({ error: loc.error })
    if (loc.data) Object.assign(data, loc.data)
    if (typeof manufactured === 'boolean') {
      // Desmarcar "fabricado" descarta a receita própria do subconjunto
      if (!manufactured && existing.manufactured) {
        await prisma.bomItem.deleteMany({ where: { parent_material_id: id } })
      }
      data.manufactured = manufactured
    }

    const supplierList = parseSuppliers(suppliers)
    const material = await prisma.$transaction(async (tx) => {
      await tx.material.update({ where: { id }, data })
      if (supplierList) {
        await tx.materialSupplier.deleteMany({ where: { material_id: id } })
        for (const [i, s] of supplierList.entries()) {
          await tx.materialSupplier.create({ data: { material_id: id, ...s, position: i } })
        }
      }
      const delta = Math.round((newStock - existing.current_stock) * 1000) / 1000
      if (delta !== 0) {
        await applyStockMovement(tx, {
          type: 'AJUSTE', actor: editor, note: 'Estoque corrigido no cadastro do material',
          changes: [{ material_id: id, quantity: delta }],
        })
      }
      await logAudit(tx, {
        entity_type: 'Material', entity_id: id, action: 'UPDATE', actor: editor,
        summary: `Material editado: ${existing.sku ? `${existing.sku} · ` : ''}${existing.name}`,
      })
      return tx.material.findUniqueOrThrow({ where: { id }, include: withSuppliers })
    })
    res.json(withStatus(material))
  } catch (e) {
    if (isUniqueError(e)) return res.status(409).json({ error: 'Já existe um material com este SKU.' })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /:id/manufacture — fabrica N unidades de um subconjunto: baixa os
// componentes da receita dele (só o nível direto; subconjuntos internos são
// consumidos como item pronto) e sobe o estoque do subconjunto.
router.post('/:id/manufacture', async (req, res) => {
  try {
    const { id } = req.params
    const { quantity, actor } = req.body ?? {}
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' })
    }
    const material = await prisma.material.findUnique({ where: { id } })
    if (!material) return res.status(404).json({ error: 'Material não encontrado.' })
    if (!material.manufactured) {
      return res.status(400).json({ error: `"${material.name}" não é fabricado internamente.` })
    }
    const recipe = await prisma.bomItem.findMany({
      where: { parent_material_id: id },
      include: { material: true },
    })
    if (recipe.length === 0) {
      return res.status(400).json({ error: `"${material.name}" ainda não tem receita cadastrada.` })
    }
    const editor = typeof actor === 'string' ? actor.trim() : ''
    if (!editor) return res.status(400).json({ error: 'Informe o seu nome para fabricar.' })

    // Só fabrica o que o estoque cobre: quem manda é o componente mais escasso.
    // Sem estoque de algum componente, não fabrica nada.
    const perItem = recipe
      .filter((r) => r.quantity > 0)
      .map((r) => ({ r, can: Math.floor((r.material.current_stock + 1e-9) / r.quantity) }))
    const possible = Math.max(0, Math.min(...perItem.map((p) => p.can)))
    if (qty > possible) {
      const missing = perItem
        .filter((p) => p.r.material.current_stock + 1e-9 < p.r.quantity * qty)
        .map((p) => ({
          name: p.r.material.name, sku: p.r.material.sku, unit: p.r.material.unit,
          current: p.r.material.current_stock, needed: Math.round(p.r.quantity * qty * 1000) / 1000,
        }))
      const error = possible === 0
        ? `Não dá para fabricar ${material.name}: falta estoque de ${missing.map((m) => m.name).join(', ')}.`
        : `Com o estoque atual dá para fabricar no máximo ${possible} ${material.unit} de ${material.name}.`
      return res.status(409).json({ error, possible, missing })
    }

    const result = await prisma.$transaction(async (tx) => {
      const consumed: { name: string; quantity: number; unit: string; current: number }[] = []
      const low: { name: string; current: number; full: number }[] = []
      // baixa os componentes e soma os prontos numa movimentação só (Fabricação)
      const { materials: changed } = await applyStockMovement(tx, {
        type: 'FABRICACAO',
        actor: editor,
        ref: `${qty} ${material.unit} de ${material.name}`,
        changes: [
          ...recipe.map((item) => ({ material_id: item.material_id, quantity: -Math.round(item.quantity * qty * 1000) / 1000 })),
          { material_id: id, quantity: qty },
        ],
      })
      for (const m of changed) {
        if (m.id === id) continue
        const used = Math.round((recipe.filter((r) => r.material_id === m.id).reduce((s, r) => s + r.quantity, 0)) * qty * 1000) / 1000
        consumed.push({ name: m.name, quantity: used, unit: m.unit, current: m.current_stock })
        if (m.full_stock > 0 && m.current_stock <= m.full_stock * LOW_STOCK_RATIO) {
          low.push({ name: m.name, current: m.current_stock, full: m.full_stock })
        }
      }
      const updated = await tx.material.findUniqueOrThrow({ where: { id } })
      await logAudit(tx, {
        entity_type: 'Material',
        entity_id: id,
        action: 'MANUFACTURE',
        actor: editor,
        summary: `Fabricou ${qty} ${updated.unit} de ${updated.name}`,
        metadata: JSON.stringify({ quantity: qty, consumed }),
      })
      return { material: withStatus(updated), consumed, lowStock: low }
    })

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ---- Foto do material ----
// GET /:id/image — a foto (o navegador guarda em cache; a URL muda quando a foto muda)
router.get('/:id/image', async (req, res) => {
  try {
    const img = await prisma.materialImage.findUnique({ where: { material_id: req.params.id } })
    if (!img) return res.status(404).json({ error: 'Material sem foto.' })
    res.setHeader('Content-Type', img.mime)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(Buffer.from(img.data))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id/image?actor=Nome — troca a foto. O corpo é a imagem (JPEG/PNG/WebP,
// até 3 MB; a tela já manda reduzida). Quem edita é obrigatório.
router.put('/:id/image', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '3mb' }), async (req, res) => {
  try {
    const { id } = req.params
    const editor = parseActor(req.query.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    const mime = String(req.headers['content-type'] ?? '').split(';')[0]
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Envie uma foto JPEG, PNG ou WebP.' })
    }
    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Material não encontrado.' })
    const material = await prisma.$transaction(async (tx) => {
      await tx.materialImage.upsert({
        where: { material_id: id },
        create: { material_id: id, data: req.body, mime },
        update: { data: req.body, mime },
      })
      await logAudit(tx, {
        entity_type: 'Material', entity_id: id, action: 'UPDATE', actor: editor,
        summary: `Foto do material trocada: ${existing.sku ?? existing.name}`,
      })
      return tx.material.update({
        where: { id },
        data: { image_updated_at: new Date(), edited_by: editor, edited_at: new Date() },
        include: withSuppliers,
      })
    })
    res.json(withStatus(material))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id/image?actor=Nome — tira a foto
router.delete('/:id/image', async (req, res) => {
  try {
    const { id } = req.params
    const editor = parseActor(req.query.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Material não encontrado.' })
    const material = await prisma.$transaction(async (tx) => {
      await tx.materialImage.deleteMany({ where: { material_id: id } })
      await logAudit(tx, {
        entity_type: 'Material', entity_id: id, action: 'UPDATE', actor: editor,
        summary: `Foto do material removida: ${existing.sku ?? existing.name}`,
      })
      return tx.material.update({
        where: { id },
        data: { image_updated_at: null, edited_by: editor, edited_at: new Date() },
        include: withSuppliers,
      })
    })
    res.json(withStatus(material))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — remove um material (e seus itens de receita via cascade)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const editor = parseActor(req.query.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Material não encontrado.' })
    await prisma.$transaction(async (tx) => {
      await tx.material.delete({ where: { id } })
      await logAudit(tx, {
        entity_type: 'Material', entity_id: id, action: 'DELETE', actor: editor,
        summary: `Material removido: ${existing.sku ? `${existing.sku} · ` : ''}${existing.name}`,
      })
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
