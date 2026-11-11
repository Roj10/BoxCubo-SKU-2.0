import { Prisma, type PrismaClient } from '@prisma/client'

// Aceita tanto o prisma global quanto um tx de $transaction.
type AuditClient = PrismaClient | Prisma.TransactionClient

export interface AuditInput {
  entity_type: string
  entity_id: string
  action: string
  actor: string
  summary: string
  metadata?: string
}

// Registro de auditoria best-effort: nunca relança para não derrubar a
// operação principal. Obs.: quando chamado dentro de um $transaction, uma
// exceção aqui reverteria a txn — por isso engolimos o erro; quem chama
// dentro de txn deve estar ciente, mas o contrato é não-relançar.
export async function logAudit(client: AuditClient, input: AuditInput): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        ...input,
        actor: input.actor || 'Sistema',
      },
    })
  } catch (error) {
    console.error('[audit] falha ao registrar', error)
  }
}
