export type AlertType = 'ENTREGA_ATRASADA' | 'MAQUINA_PARADA' | 'REVISAO_PENDENTE' | 'MATERIAL_BAIXO'

export type AlertSeverity = 'alta' | 'media' | 'baixa'

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  link: string
}

export interface AlertsResponse {
  alerts: Alert[]
  count: number
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  ENTREGA_ATRASADA: 'Entregas atrasadas',
  MAQUINA_PARADA: 'Máquinas paradas',
  REVISAO_PENDENTE: 'Revisões pendentes',
  MATERIAL_BAIXO: 'Materiais baixos',
}
