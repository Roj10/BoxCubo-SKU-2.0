import { Prisma, type PrismaClient } from '@prisma/client'

// Aceita o prisma global ou um tx de $transaction.
type Client = PrismaClient | Prisma.TransactionClient

export const MOVEMENT_TYPES = [
  'ENTRADA', 'SAIDA', 'PRODUCAO', 'PRODUCAO_CANCELADA', 'FABRICACAO', 'AJUSTE', 'ESTORNO',
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export interface StockChange {
  material_id: string
  quantity: number // positivo entra, negativo sai
}

// Aplica as mudanças de estoque e grava a movimentação com o antes/depois de
// cada material. Deve rodar dentro de um $transaction. Mudanças repetidas do
// mesmo material são somadas; quantidade zero é ignorada.
export async function applyStockMovement(
  tx: Client,
  input: { type: MovementType; actor: string; note?: string | null; ref?: string | null; reverses_id?: string | null; changes: StockChange[] }
) {
  const total = new Map<string, number>()
  for (const c of input.changes) {
    if (!Number.isFinite(c.quantity) || c.quantity === 0) continue
    total.set(c.material_id, Math.round(((total.get(c.material_id) ?? 0) + c.quantity) * 1000) / 1000)
  }
  const items: Prisma.MaterialMovementItemCreateWithoutMovementInput[] = []
  const updated = []
  for (const [material_id, quantity] of total) {
    if (quantity === 0) continue
    const m = await tx.material.update({ where: { id: material_id }, data: { current_stock: { increment: quantity } } })
    updated.push(m)
    items.push({
      material_id,
      material_name: m.name,
      sku: m.sku,
      unit: m.unit,
      quantity,
      before: Math.round((m.current_stock - quantity) * 1000) / 1000,
      after: m.current_stock,
    })
  }
  if (items.length === 0) return { movement: null, materials: updated }
  const movement = await tx.materialMovement.create({
    data: {
      type: input.type,
      actor: input.actor?.trim() || 'Sistema',
      note: input.note?.trim() || null,
      ref: input.ref?.trim() || null,
      reverses_id: input.reverses_id ?? null,
      items: { create: items },
    },
    include: { items: true },
  })
  return { movement, materials: updated }
}
