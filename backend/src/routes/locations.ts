import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'

// Localização dos materiais no almoxarifado: estantes (E1, E2...) com
// prateleiras (P1..Pn), e cada prateleira pode ter caixas (C1..Cn).
// Cada material fica em E-P-C (ex: E1-P2-C3) ou solto na prateleira (E1-P2).
const router = Router()

const MAX_LEVELS = 30
const MAX_BOXES = 50
const label = (n: number, level?: number | null, box?: number | null) =>
  `E${n}${level ? `-P${level}` : ''}${level && box ? `-C${box}` : ''}`

// Nome é opcional nesta tela: sem nome, fica registrado como "Sistema"
function parseActor(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : 'Sistema'
}

function parseLevels(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= MAX_LEVELS ? n : null
}

const materialSelect = { id: true, sku: true, name: true, unit: true, current_stock: true, rack_level: true, rack_box: true, manufactured: true, image_updated_at: true }

// GET / — estantes com as prateleiras e os materiais de cada uma,
// e os materiais ainda sem lugar
router.get('/', async (_req, res) => {
  try {
    const [racks, unplaced] = await Promise.all([
      prisma.storageRack.findMany({
        orderBy: { number: 'asc' },
        include: {
          materials: { select: materialSelect, orderBy: [{ sku: 'asc' }, { name: 'asc' }] },
          shelves: { select: { level: true, boxes: true } },
        },
      }),
      prisma.material.findMany({ where: { rack_id: null }, select: materialSelect, orderBy: [{ sku: 'asc' }, { name: 'asc' }] }),
    ])
    res.json({ racks, unplaced })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /racks — nova estante { levels, note?, actor }. Recebe o próximo número livre.
router.post('/racks', async (req, res) => {
  try {
    const actor = parseActor(req.body?.actor)
    const levels = parseLevels(req.body?.levels)
    if (!levels) return res.status(400).json({ error: `Quantidade de prateleiras deve ser de 1 a ${MAX_LEVELS}.` })
    const note = typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, 120) : null
    const rack = await prisma.$transaction(async (tx) => {
      const last = await tx.storageRack.findFirst({ orderBy: { number: 'desc' } })
      const created = await tx.storageRack.create({ data: { number: (last?.number ?? 0) + 1, levels, note } })
      await logAudit(tx, {
        entity_type: 'StorageRack', entity_id: created.id, action: 'CREATE', actor,
        summary: `Estante E${created.number} criada com ${levels} prateleira(s)`,
      })
      return created
    })
    res.status(201).json(rack)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /racks/:id — muda a quantidade de prateleiras e/ou a observação.
// Não deixa tirar prateleira que ainda tem material.
router.patch('/racks/:id', async (req, res) => {
  try {
    const actor = parseActor(req.body?.actor)
    const rack = await prisma.storageRack.findUnique({ where: { id: req.params.id } })
    if (!rack) return res.status(404).json({ error: 'Estante não encontrada.' })
    const data: { levels?: number; note?: string | null } = {}
    if (req.body?.levels !== undefined) {
      const levels = parseLevels(req.body.levels)
      if (!levels) return res.status(400).json({ error: `Quantidade de prateleiras deve ser de 1 a ${MAX_LEVELS}.` })
      if (levels < rack.levels) {
        const blocking = await prisma.material.findMany({
          where: { rack_id: rack.id, rack_level: { gt: levels } },
          select: { sku: true, name: true, rack_level: true },
        })
        if (blocking.length) {
          return res.status(409).json({
            error: `Ainda tem material nas prateleiras acima de P${levels}: ${blocking.map((m) => `${m.sku ?? m.name} (P${m.rack_level})`).join(', ')}. Mude esses materiais de lugar antes.`,
          })
        }
      }
      data.levels = levels
    }
    if (req.body?.note !== undefined) {
      data.note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, 120) : null
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.storageRack.update({ where: { id: rack.id }, data })
      if (data.levels !== undefined) await tx.storageShelf.deleteMany({ where: { rack_id: rack.id, level: { gt: data.levels } } })
      await logAudit(tx, {
        entity_type: 'StorageRack', entity_id: rack.id, action: 'UPDATE', actor,
        summary: `Estante E${rack.number} editada${data.levels !== undefined && data.levels !== rack.levels ? `: ${rack.levels} → ${data.levels} prateleiras` : ''}`,
      })
      return u
    })
    res.json(updated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /racks/:id?actor= — apaga a estante; os materiais dela ficam sem localização
router.delete('/racks/:id', async (req, res) => {
  try {
    const actor = parseActor(req.query.actor)
    const rack = await prisma.storageRack.findUnique({ where: { id: req.params.id }, include: { _count: { select: { materials: true } } } })
    if (!rack) return res.status(404).json({ error: 'Estante não encontrada.' })
    await prisma.$transaction(async (tx) => {
      await tx.material.updateMany({ where: { rack_id: rack.id }, data: { rack_id: null, rack_level: null, rack_box: null } })
      await tx.storageRack.delete({ where: { id: rack.id } })
      await logAudit(tx, {
        entity_type: 'StorageRack', entity_id: rack.id, action: 'DELETE', actor,
        summary: `Estante E${rack.number} excluída${rack._count.materials ? ` (${rack._count.materials} material(is) ficaram sem localização)` : ''}`,
      })
    })
    res.json({ unplaced: rack._count.materials })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /shelves — quantas caixas uma prateleira tem { rack_id, level, boxes, actor }.
// Não deixa tirar caixa que ainda tem material.
router.put('/shelves', async (req, res) => {
  try {
    const actor = parseActor(req.body?.actor)
    const rack = await prisma.storageRack.findUnique({ where: { id: String(req.body?.rack_id ?? '') } })
    if (!rack) return res.status(404).json({ error: 'Estante não encontrada.' })
    const level = Number(req.body?.level)
    if (!Number.isInteger(level) || level < 1 || level > rack.levels) {
      return res.status(400).json({ error: `A estante E${rack.number} tem prateleiras de P1 a P${rack.levels}.` })
    }
    const boxes = Number(req.body?.boxes)
    if (!Number.isInteger(boxes) || boxes < 0 || boxes > MAX_BOXES) {
      return res.status(400).json({ error: `Quantidade de caixas deve ser de 0 a ${MAX_BOXES}.` })
    }
    const blocking = await prisma.material.findMany({
      where: { rack_id: rack.id, rack_level: level, rack_box: { gt: boxes } },
      select: { sku: true, name: true, rack_box: true },
    })
    if (blocking.length) {
      return res.status(409).json({
        error: `Ainda tem material nas caixas acima de C${boxes}: ${blocking.map((m) => `${m.sku ?? m.name} (C${m.rack_box})`).join(', ')}. Mude esses materiais de lugar antes.`,
      })
    }
    await prisma.$transaction(async (tx) => {
      if (boxes === 0) await tx.storageShelf.deleteMany({ where: { rack_id: rack.id, level } })
      else await tx.storageShelf.upsert({
        where: { rack_id_level: { rack_id: rack.id, level } },
        create: { rack_id: rack.id, level, boxes },
        update: { boxes },
      })
      await logAudit(tx, {
        entity_type: 'StorageRack', entity_id: rack.id, action: 'UPDATE', actor,
        summary: `Prateleira ${label(rack.number, level)} agora tem ${boxes} caixa(s)`,
      })
    })
    res.json({ rack_id: rack.id, level, boxes })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /assign — coloca materiais numa prateleira/caixa (ou tira de lugar)
// { material_ids: [], rack_id: string | null, level: number | null, box?: number | null, actor }
router.put('/assign', async (req, res) => {
  try {
    const actor = parseActor(req.body?.actor)
    const ids: string[] = Array.isArray(req.body?.material_ids) ? req.body.material_ids.filter((x: unknown) => typeof x === 'string') : []
    if (!ids.length) return res.status(400).json({ error: 'Escolha pelo menos um material.' })
    let rack: { id: string; number: number; levels: number } | null = null
    let level: number | null = null
    let box: number | null = null
    if (req.body?.rack_id) {
      const found = await prisma.storageRack.findUnique({ where: { id: String(req.body.rack_id) }, include: { shelves: true } })
      if (!found) return res.status(404).json({ error: 'Estante não encontrada.' })
      rack = found
      level = Number(req.body.level)
      if (!Number.isInteger(level) || level < 1 || level > found.levels) {
        return res.status(400).json({ error: `A estante E${found.number} tem prateleiras de P1 a P${found.levels}.` })
      }
      if (req.body.box !== undefined && req.body.box !== null && req.body.box !== '') {
        box = Number(req.body.box)
        const boxes = found.shelves.find((s) => s.level === level)?.boxes ?? 0
        if (!Number.isInteger(box) || box < 1 || box > boxes) {
          return res.status(400).json({ error: boxes ? `A prateleira ${label(found.number, level)} tem caixas de C1 a C${boxes}.` : `A prateleira ${label(found.number, level)} não tem caixas.` })
        }
      }
    }
    const where = rack ? label(rack.number, level, box) : 'sem localização'
    const result = await prisma.$transaction(async (tx) => {
      const mats = await tx.material.findMany({ where: { id: { in: ids } }, select: { id: true, sku: true, name: true } })
      await tx.material.updateMany({
        where: { id: { in: mats.map((m) => m.id) } },
        data: { rack_id: rack?.id ?? null, rack_level: rack ? level : null, rack_box: rack ? box : null, edited_by: actor, edited_at: new Date() },
      })
      for (const m of mats) {
        await logAudit(tx, {
          entity_type: 'Material', entity_id: m.id, action: 'UPDATE', actor,
          summary: `Localização de ${m.sku ? `${m.sku} · ` : ''}${m.name}: ${where}`,
        })
      }
      return mats.length
    })
    res.json({ updated: result, location: rack ? where : null })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
