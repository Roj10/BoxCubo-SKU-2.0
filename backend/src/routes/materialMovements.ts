import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { applyStockMovement, MOVEMENT_TYPES } from '../lib/stockMovements'

// Movimentações do estoque de materiais: histórico, entrada, saída e estorno.
const router = Router()

type ItemInput = { material_id: string; quantity: number }

function parseItems(value: unknown): ItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const out: ItemInput[] = []
  for (const it of value) {
    const q = Number(typeof it?.quantity === 'string' ? it.quantity.replace(',', '.') : it?.quantity)
    if (typeof it?.material_id !== 'string' || !Number.isFinite(q) || q <= 0) return null
    out.push({ material_id: it.material_id, quantity: Math.round(q * 1000) / 1000 })
  }
  return out
}

// GET / — histórico (mais recentes primeiro). ?type=ENTRADA&q=texto
router.get('/', async (req, res) => {
  try {
    const type = typeof req.query.type === 'string' && (MOVEMENT_TYPES as readonly string[]).includes(req.query.type) ? req.query.type : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
    const list = await prisma.materialMovement.findMany({
      where: type ? { type } : undefined,
      include: { items: true },
      orderBy: { created_at: 'desc' },
      take: 500,
    })
    const filtered = q
      ? list.filter((m) =>
          [m.actor, m.note ?? '', m.ref ?? '', ...m.items.map((i) => `${i.sku ?? ''} ${i.material_name}`)]
            .join(' ').toLowerCase().includes(q))
      : list
    res.json(filtered.slice(0, 300))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /entrada — chegou material (compra, devolução de fornecedor...)
router.post('/entrada', async (req, res) => {
  try {
    const { actor, note } = req.body ?? {}
    const items = parseItems(req.body?.items)
    if (!items) return res.status(400).json({ error: 'Informe os materiais e as quantidades.' })
    const found = await prisma.material.count({ where: { id: { in: items.map((i) => i.material_id) } } })
    if (found !== new Set(items.map((i) => i.material_id)).size) return res.status(404).json({ error: 'Material não encontrado.' })
    const { movement } = await prisma.$transaction(async (tx) => {
      const r = await applyStockMovement(tx, { type: 'ENTRADA', actor, note, changes: items })
      await logAudit(tx, {
        entity_type: 'MaterialMovement', entity_id: r.movement!.id, action: 'CREATE', actor: actor || 'Sistema',
        summary: `Entrada de ${r.movement!.items.length} material(is)`,
      })
      return r
    })
    res.status(201).json(movement)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /saida — saída avulsa (peças para manutenção de cliente, perda...).
// Se faltar estoque, responde 409 com as faltas; com allow_short=true, tira o
// que tem (o estoque fica em 0) e anota a falta na observação.
router.post('/saida', async (req, res) => {
  try {
    const { actor, note, allow_short } = req.body ?? {}
    const items = parseItems(req.body?.items)
    if (!items) return res.status(400).json({ error: 'Informe os materiais e as quantidades.' })
    const materials = await prisma.material.findMany({ where: { id: { in: items.map((i) => i.material_id) } } })
    const byId = new Map(materials.map((m) => [m.id, m]))
    if (items.some((i) => !byId.has(i.material_id))) return res.status(404).json({ error: 'Material não encontrado.' })

    const shortages = items
      .map((i) => {
        const m = byId.get(i.material_id)!
        return { material_id: m.id, name: m.name, sku: m.sku, unit: m.unit, requested: i.quantity, available: Math.max(0, m.current_stock) }
      })
      .filter((s) => s.available < s.requested)
    if (shortages.length && allow_short !== true) {
      return res.status(409).json({ error: 'Estoque insuficiente.', shortages })
    }
    const shortNote = shortages.length
      ? `Faltou: ${shortages.map((s) => `${s.sku ?? s.name} ${s.requested - s.available} ${s.unit}`).join(', ')}`
      : ''
    const changes = items.map((i) => {
      const s = shortages.find((x) => x.material_id === i.material_id)
      return { material_id: i.material_id, quantity: -(s ? s.available : i.quantity) }
    })
    const { movement } = await prisma.$transaction(async (tx) => {
      const r = await applyStockMovement(tx, {
        type: 'SAIDA', actor, note: [note, shortNote].filter(Boolean).join(' · '), changes,
      })
      if (r.movement) {
        await logAudit(tx, {
          entity_type: 'MaterialMovement', entity_id: r.movement.id, action: 'CREATE', actor: actor || 'Sistema',
          summary: `Saída de ${r.movement.items.length} material(is)`,
        })
      }
      return r
    })
    if (!movement) return res.status(400).json({ error: 'Nada para tirar: os materiais estão sem estoque.' })
    res.status(201).json(movement)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /:id/estorno — desfaz uma movimentação (lança o contrário)
router.post('/:id/estorno', async (req, res) => {
  try {
    const { actor, note } = req.body ?? {}
    const orig = await prisma.materialMovement.findUnique({ where: { id: req.params.id }, include: { items: true } })
    if (!orig) return res.status(404).json({ error: 'Movimentação não encontrada.' })
    if (orig.reversed_by_id) return res.status(400).json({ error: 'Esta movimentação já foi estornada.' })
    if (orig.type === 'ESTORNO') return res.status(400).json({ error: 'Não dá para estornar um estorno.' })
    if (orig.type === 'PRODUCAO' || orig.type === 'PRODUCAO_CANCELADA') {
      return res.status(400).json({ error: 'Movimentação de produção: para devolver os materiais, cancele a produção da máquina.' })
    }
    const existing = new Set((await prisma.material.findMany({ where: { id: { in: orig.items.map((i) => i.material_id) } }, select: { id: true } })).map((m) => m.id))
    const { movement } = await prisma.$transaction(async (tx) => {
      const r = await applyStockMovement(tx, {
        type: 'ESTORNO', actor, reverses_id: orig.id,
        note: note || `Estorno da movimentação de ${orig.created_at.toLocaleDateString('pt-BR')}`,
        ref: orig.ref,
        changes: orig.items.filter((i) => existing.has(i.material_id)).map((i) => ({ material_id: i.material_id, quantity: -i.quantity })),
      })
      if (r.movement) {
        await tx.materialMovement.update({ where: { id: orig.id }, data: { reversed_by_id: r.movement.id } })
        await logAudit(tx, {
          entity_type: 'MaterialMovement', entity_id: orig.id, action: 'UPDATE', actor: actor || 'Sistema',
          summary: 'Movimentação de materiais estornada',
        })
      }
      return r
    })
    if (!movement) return res.status(400).json({ error: 'Nada para estornar: os materiais foram removidos.' })
    res.status(201).json(movement)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
