import type { Machine } from './machine'

export type DeliveryStatus = 'AGUARDANDO_COLETA' | 'ENTREGUE'

export interface Delivery {
  id: string
  machine_id: string
  machine: Machine
  carrier: string
  pickup_date: string | null
  expected_date: string | null
  status: DeliveryStatus
  created_at: string
  updated_at: string
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  AGUARDANDO_COLETA: 'Aguardando coleta',
  ENTREGUE: 'Entregue',
}
