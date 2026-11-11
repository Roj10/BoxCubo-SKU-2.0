export type ReturnCondition = 'Boa' | 'Com defeito' | 'Danificada'
export type ReturnDestination = 'ESTOQUE' | 'EM_REVISAO'

export interface Return {
  id: string
  machine_id: string
  reason: string
  condition: ReturnCondition
  destination: ReturnDestination
  created_at: string
}

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  'Boa': 'Boa',
  'Com defeito': 'Com defeito',
  'Danificada': 'Danificada',
}

export const RETURN_DESTINATION_LABELS: Record<ReturnDestination, string> = {
  ESTOQUE: 'Retornou ao estoque',
  EM_REVISAO: 'Entrou em revisao',
}
