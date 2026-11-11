export type AuditEntityType = 'Machine' | 'Delivery' | 'Return' | 'ProductionStage' | 'Material'

export type AuditAction = 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE' | 'MANUFACTURE'

export interface AuditLog {
  id: string
  entity_type: AuditEntityType
  entity_id: string
  action: AuditAction
  actor: string
  summary: string
  metadata: string | null
  created_at: string
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Edição',
  STATUS_CHANGE: 'Mudança de status',
  DELETE: 'Exclusão',
  MANUFACTURE: 'Fabricação',
}

export const ENTITY_LABELS: Record<AuditEntityType, string> = {
  Machine: 'Máquina',
  Delivery: 'Entrega',
  Return: 'Devolução',
  ProductionStage: 'Produção',
  Material: 'Material',
}

// Ação como texto colorido, sem fundo — a cor carrega o significado
export const ACTION_BADGE_CLASSES: Record<AuditAction, string> = {
  CREATE: 'text-emerald-700 dark:text-emerald-400',
  UPDATE: 'text-blue-700 dark:text-blue-400',
  STATUS_CHANGE: 'text-amber-700 dark:text-amber-400',
  DELETE: 'text-red-700 dark:text-red-400',
  MANUFACTURE: 'text-brand-700 dark:text-brand-400',
}
