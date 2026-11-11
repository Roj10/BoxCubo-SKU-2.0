import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { materialNeeds, toBuy } from '../lib/stockTargets'
import { buildCsv, csvMoney, csvNum, sendCsv, slug } from '../lib/csv'

// Fornecedores: quem fornece cada material, o código do item em cada um,
// pedido para repor o estoque mínimo, renomear/juntar e "não trabalho mais".
const router = Router()

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Quem está fazendo a alteração (sem login): obrigatório para mexer em fornecedores
function parseActor(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : null
}
const ACTOR_REQUIRED = 'Informe o seu nome para alterar fornecedores.'

// anota no material quem editou por último
async function markEdited(tx: any, materialIds: string[], editor: string) {
  if (materialIds.length === 0) return
  await tx.material.updateMany({ where: { id: { in: materialIds } }, data: { edited_by: editor, edited_at: new Date() } })
}

// Lê uma vez os materiais (com fornecedores) e os mínimos calculados das receitas
async function loadContext() {
  const { needs } = await materialNeeds()
  const materials = await prisma.material.findMany({
    include: { suppliers: { orderBy: { position: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return { needs, materials }
}
type Context = Awaited<ReturnType<typeof loadContext>>

// Materiais vistos pelo lado de um fornecedor (ou sem fornecedor, se name = null)
async function supplierMaterials(name: string | null, ctx?: Context) {
  const { needs, materials } = ctx ?? (await loadContext())
  const out = []
  for (const m of materials) {
    const idx = name === null ? -1 : m.suppliers.findIndex((s) => s.name === name)
    if (name === null ? m.suppliers.length > 0 || m.manufactured : idx < 0) continue
    const minimum = needs.get(m.id)?.minimum ?? 0
    const buy = m.manufactured ? 0 : toBuy(minimum, m.current_stock, m.unit)
    out.push({
      material_id: m.id, sku: m.sku, name: m.name, unit: m.unit,
      code: idx >= 0 ? m.suppliers[idx].code : null,
      principal: idx === 0,
      others: m.suppliers.filter((_, i) => i !== idx).map((s) => s.name),
      current: m.current_stock, minimum, buy,
      price: m.price, cost: m.price != null && buy > 0 ? Math.round(buy * m.price * 100) / 100 : null,
      products: needs.get(m.id)?.products ?? [],
    })
  }
  return out.sort((a, b) => (a.sku ?? '￿' + a.name).localeCompare(b.sku ?? '￿' + b.name))
}

// GET / — resumo: cada fornecedor com nº de materiais, sem código e para comprar
router.get('/', async (_req, res) => {
  try {
    const ctx = await loadContext() // uma leitura só para todos os fornecedores
    const names = [...new Set(ctx.materials.flatMap((m) => m.suppliers.map((s) => s.name)))]
    const summary = []
    for (const name of names) {
      const mats = await supplierMaterials(name, ctx)
      const order = mats.filter((m) => m.principal && m.buy > 0)
      summary.push({
        name,
        materials: mats.length,
        principal: mats.filter((m) => m.principal).length,
        without_code: mats.filter((m) => !m.code).length,
        to_buy: order.length,
        order_cost: Math.round(order.reduce((s, m) => s + (m.cost ?? 0), 0) * 100) / 100,
      })
    }
    summary.sort((a, b) => b.materials - a.materials || a.name.localeCompare(b.name))
    const none = await supplierMaterials(null, ctx)
    res.json({ suppliers: summary, without_supplier: none.length })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /materials?name=Fornell — materiais do fornecedor (sem name: os sem fornecedor)
router.get('/materials', async (req, res) => {
  try {
    const name = typeof req.query.name === 'string' && req.query.name ? req.query.name : null
    res.json(await supplierMaterials(name))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /order.csv?name=Fornell — pedido: o que comprar dele para voltar ao mínimo
router.get('/order.csv', async (req, res) => {
  try {
    const name = typeof req.query.name === 'string' ? req.query.name : ''
    const order = (await supplierMaterials(name)).filter((m) => m.principal && m.buy > 0)
    const rows: (string | number)[][] = order.map((m) => [
      m.code ?? '', m.name, m.unit, csvNum(m.buy), csvMoney(m.price), csvMoney(m.cost), m.sku ?? '',
    ])
    rows.push(['', '', '', '', 'Total', csvMoney(order.reduce((s, m) => s + (m.cost ?? 0), 0)), ''])
    sendCsv(res, `pedido-${slug(name)}.csv`, buildCsv(
      ['Código no fornecedor', 'Descrição', 'Unidade', 'Quantidade', 'Preço unit.', 'Total', 'SKU Box Cubo'], rows))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /code — { material_id, name, code }: código do item neste fornecedor
router.put('/code', async (req, res) => {
  try {
    const { material_id, name, code } = req.body ?? {}
    const editor = parseActor(req.body?.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    const row = await prisma.materialSupplier.findFirst({ where: { material_id, name } })
    if (!row) return res.status(404).json({ error: 'Fornecedor não encontrado neste material.' })
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.materialSupplier.update({
        where: { id: row.id },
        data: { code: typeof code === 'string' && code.trim() ? code.trim().slice(0, 120) : null },
      })
      await markEdited(tx, [material_id], editor)
      return u
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// reordena as posições (0, 1, 2...) depois de tirar/trocar fornecedores
async function renumber(tx: any, material_id: string) {
  const rows = await tx.materialSupplier.findMany({ where: { material_id }, orderBy: { position: 'asc' } })
  for (const [i, r] of rows.entries()) {
    if (r.position !== i) await tx.materialSupplier.update({ where: { id: r.id }, data: { position: i } })
  }
}

// POST /rename — { from, to }: troca o nome em todos os materiais. Se "to" já
// existir num material, os dois viram um só (fica o código preenchido).
router.post('/rename', async (req, res) => {
  try {
    const from = String(req.body?.from ?? '').trim()
    const to = String(req.body?.to ?? '').trim().slice(0, 120)
    const editor = parseActor(req.body?.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    if (!from || !to || from === to) return res.status(400).json({ error: 'Informe o nome atual e o novo.' })
    const rows = await prisma.materialSupplier.findMany({ where: { name: from } })
    if (rows.length === 0) return res.status(404).json({ error: 'Fornecedor não encontrado.' })
    await prisma.$transaction(async (tx) => {
      for (const r of rows) {
        const other = await tx.materialSupplier.findFirst({ where: { material_id: r.material_id, name: to } })
        if (!other) {
          await tx.materialSupplier.update({ where: { id: r.id }, data: { name: to } })
          continue
        }
        // o material tinha os dois: fica um só, na melhor posição
        const keep = r.position < other.position ? r : other
        const drop = keep === r ? other : r
        await tx.materialSupplier.delete({ where: { id: drop.id } })
        await tx.materialSupplier.update({ where: { id: keep.id }, data: { name: to, code: other.code ?? r.code } })
        await renumber(tx, r.material_id)
      }
      await markEdited(tx, rows.map((r) => r.material_id), editor)
      await logAudit(tx, {
        entity_type: 'Supplier', entity_id: to, action: 'UPDATE', actor: editor,
        summary: `Fornecedor "${from}" renomeado para "${to}" em ${rows.length} material(is)`,
      })
    })
    res.json({ materials: rows.length, name: to })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /replace — { from, to }: não trabalha mais com "from". Com "to", ele
// assume o lugar (sem o código antigo); sem "to", "from" só sai dos materiais.
router.post('/replace', async (req, res) => {
  try {
    const from = String(req.body?.from ?? '').trim()
    const to = String(req.body?.to ?? '').trim().slice(0, 120)
    const editor = parseActor(req.body?.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    if (!from || sameName(from, to)) return res.status(400).json({ error: 'Escolha um fornecedor diferente.' })
    const rows = await prisma.materialSupplier.findMany({ where: { name: from } })
    if (rows.length === 0) return res.status(404).json({ error: 'Fornecedor não encontrado.' })
    const withoutSupplier: string[] = []
    await prisma.$transaction(async (tx) => {
      for (const r of rows) {
        const other = to ? await tx.materialSupplier.findFirst({ where: { material_id: r.material_id, name: to } }) : null
        if (!to) {
          await tx.materialSupplier.delete({ where: { id: r.id } })
        } else if (other) {
          // já tinha o novo: ele assume a posição do antigo (com o código dele)
          await tx.materialSupplier.delete({ where: { id: r.id } })
          await tx.materialSupplier.update({ where: { id: other.id }, data: { position: r.position } })
        } else {
          await tx.materialSupplier.update({ where: { id: r.id }, data: { name: to, code: null } })
        }
        await renumber(tx, r.material_id)
        if ((await tx.materialSupplier.count({ where: { material_id: r.material_id } })) === 0) {
          const m = await tx.material.findUnique({ where: { id: r.material_id }, select: { sku: true, name: true } })
          if (m) withoutSupplier.push(m.sku ?? m.name)
        }
      }
      await markEdited(tx, rows.map((r) => r.material_id), editor)
      await logAudit(tx, {
        entity_type: 'Supplier', entity_id: from, action: 'UPDATE', actor: editor,
        summary: to ? `Materiais de "${from}" passaram para "${to}" (${rows.length})` : `"${from}" tirado de ${rows.length} material(is)`,
      })
    })
    res.json({ materials: rows.length, without_supplier: withoutSupplier })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /link — { name, actor, items: [{ material_id, code, principal }] }
// Liga materiais a um fornecedor (novo ou existente). "principal" coloca o
// fornecedor em 1º lugar no material (é quem entra no pedido da Reposição).
// Material que já tem esse fornecedor só tem o código atualizado.
router.post('/link', async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 120)
    const editor = parseActor(req.body?.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    if (!name) return res.status(400).json({ error: 'Informe o nome do fornecedor.' })
    const items: { material_id: string; code?: string; principal?: boolean }[] = Array.isArray(req.body?.items) ? req.body.items : []
    if (items.length === 0) return res.status(400).json({ error: 'Escolha pelo menos um material.' })
    const ids = [...new Set(items.map((i) => i.material_id))]
    const found = await prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true, manufactured: true, name: true } })
    if (found.length !== ids.length) return res.status(404).json({ error: 'Material não encontrado.' })
    const fabricado = found.find((m) => m.manufactured)
    if (fabricado) return res.status(400).json({ error: `"${fabricado.name}" é fabricado na Box Cubo: não tem fornecedor.` })

    // se já existe um fornecedor com esse nome (diferença só de maiúsculas), usa o nome dele
    const same = await prisma.materialSupplier.findMany({ select: { name: true }, distinct: ['name'] })
    const finalName = same.find((s) => sameName(s.name, name))?.name ?? name

    let added = 0
    let updated = 0
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const code = typeof it.code === 'string' && it.code.trim() ? it.code.trim().slice(0, 120) : null
        const existing = await tx.materialSupplier.findFirst({ where: { material_id: it.material_id, name: finalName } })
        if (existing) {
          await tx.materialSupplier.update({ where: { id: existing.id }, data: { code: code ?? existing.code, ...(it.principal ? { position: -1 } : {}) } })
          updated++
        } else {
          const count = await tx.materialSupplier.count({ where: { material_id: it.material_id } })
          await tx.materialSupplier.create({
            data: { material_id: it.material_id, name: finalName, code, position: it.principal ? -1 : count },
          })
          added++
        }
        await renumber(tx, it.material_id) // -1 vira o 1º (principal)
      }
      await markEdited(tx, ids, editor)
      await logAudit(tx, {
        entity_type: 'Supplier', entity_id: finalName, action: 'UPDATE', actor: editor,
        summary: `Fornecedor "${finalName}": ${added} material(is) adicionado(s)${updated ? `, ${updated} atualizado(s)` : ''}`,
      })
    })
    res.status(201).json({ name: finalName, added, updated })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /unlink — { name, material_id, actor }: tira o fornecedor de um material
router.post('/unlink', async (req, res) => {
  try {
    const { name, material_id } = req.body ?? {}
    const editor = parseActor(req.body?.actor)
    if (!editor) return res.status(400).json({ error: ACTOR_REQUIRED })
    const row = await prisma.materialSupplier.findFirst({ where: { material_id, name } })
    if (!row) return res.status(404).json({ error: 'Fornecedor não encontrado neste material.' })
    const material = await prisma.material.findUnique({ where: { id: material_id }, select: { sku: true, name: true } })
    await prisma.$transaction(async (tx) => {
      await tx.materialSupplier.delete({ where: { id: row.id } })
      await renumber(tx, material_id)
      await markEdited(tx, [material_id], editor)
      await logAudit(tx, {
        entity_type: 'Supplier', entity_id: name, action: 'UPDATE', actor: editor,
        summary: `"${name}" tirado de ${material?.sku ?? material?.name ?? 'material'}`,
      })
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
