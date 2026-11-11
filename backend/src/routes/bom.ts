import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

const PRODUCTS = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE'] as const
const MAX_DEPTH = 6 // profundidade máxima da árvore de receita (proteção contra laços)

// Carrega a receita de um pai (produto ou material fabricado) e, para cada
// componente fabricado, aninha a receita dele em `material.components`.
export async function loadRecipeTree(
  parent: { product_type: string } | { parent_material_id: string },
  depth = 0,
  seen: Set<string> = new Set()
): Promise<any[]> {
  const items = await prisma.bomItem.findMany({
    where: parent,
    include: { material: true },
    orderBy: { material: { name: 'asc' } },
  })
  const result = []
  for (const item of items) {
    let components: any[] = []
    if (item.material.manufactured && depth < MAX_DEPTH && !seen.has(item.material_id)) {
      const nextSeen = new Set(seen)
      nextSeen.add(item.material_id)
      components = await loadRecipeTree({ parent_material_id: item.material_id }, depth + 1, nextSeen)
    }
    result.push({ ...item, material: { ...item.material, components } })
  }
  return result
}

// Verifica se `candidateId` contém `targetId` em algum nível da sua receita
// (usado para impedir laços: A usa B, B usa A).
async function recipeContains(candidateId: string, targetId: string, depth = 0): Promise<boolean> {
  if (candidateId === targetId) return true
  if (depth > MAX_DEPTH) return false
  const children = await prisma.bomItem.findMany({
    where: { parent_material_id: candidateId },
    select: { material_id: true },
  })
  for (const c of children) {
    if (await recipeContains(c.material_id, targetId, depth + 1)) return true
  }
  return false
}

// GET /material/:materialId — receita de um subconjunto fabricado (em árvore)
router.get('/material/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params
    const material = await prisma.material.findUnique({ where: { id: materialId } })
    if (!material) return res.status(404).json({ error: 'Material não encontrado.' })
    const items = await loadRecipeTree({ parent_material_id: materialId }, 1, new Set([materialId]))
    res.json(items)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /:productType — receita de um produto (em árvore: subconjuntos trazem seus componentes)
router.get('/:productType', async (req, res) => {
  try {
    const { productType } = req.params
    if (!PRODUCTS.includes(productType as any)) {
      return res.status(400).json({ error: 'Produto inválido.' })
    }
    const items = await loadRecipeTree({ product_type: productType })
    res.json(items)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST / — adiciona um material à receita de um produto OU de um subconjunto fabricado
// body: { product_type } ou { parent_material_id }, + material_id, quantity
router.post('/', async (req, res) => {
  try {
    const { product_type, parent_material_id, material_id, quantity } = req.body ?? {}

    const hasProduct = typeof product_type === 'string' && product_type !== ''
    const hasParent = typeof parent_material_id === 'string' && parent_material_id !== ''
    if ((hasProduct && hasParent) || (!hasProduct && !hasParent)) {
      return res.status(400).json({ error: 'Informe o produto ou o subconjunto da receita.' })
    }
    if (hasProduct && !PRODUCTS.includes(product_type as any)) {
      return res.status(400).json({ error: 'Produto inválido.' })
    }

    const material = await prisma.material.findUnique({ where: { id: material_id } })
    if (!material) return res.status(404).json({ error: 'Material não encontrado.' })

    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' })
    }

    if (hasParent) {
      const parent = await prisma.material.findUnique({ where: { id: parent_material_id } })
      if (!parent) return res.status(404).json({ error: 'Subconjunto não encontrado.' })
      if (!parent.manufactured) {
        return res.status(400).json({ error: `"${parent.name}" não está marcado como fabricado internamente.` })
      }
      if (parent_material_id === material_id) {
        return res.status(400).json({ error: 'Um subconjunto não pode entrar na própria receita.' })
      }
      if (material.manufactured && (await recipeContains(material_id, parent_material_id))) {
        return res.status(400).json({ error: `"${material.name}" já usa "${parent.name}" na receita — isso criaria um laço.` })
      }
    }

    const existing = await prisma.bomItem.findFirst({
      where: hasProduct ? { product_type, material_id } : { parent_material_id, material_id },
    })
    if (existing) {
      return res.status(409).json({ error: 'Este material já está nesta receita.' })
    }

    const item = await prisma.bomItem.create({
      data: hasProduct
        ? { product_type, material_id, quantity: qty }
        : { parent_material_id, material_id, quantity: qty },
      include: { material: true },
    })
    res.status(201).json({ ...item, material: { ...item.material, components: [] } })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id — atualiza a quantidade de um item da receita
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const qty = Number(req.body?.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' })
    }
    const existing = await prisma.bomItem.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Item não encontrado.' })

    const item = await prisma.bomItem.update({
      where: { id },
      data: { quantity: qty },
      include: { material: true },
    })
    res.json(item)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — remove um material de uma receita
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.bomItem.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Item não encontrado.' })
    await prisma.bomItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
