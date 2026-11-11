import type { ProductType, MachineType, MachineStatus } from './machine'

export interface Client {
  id: string
  nome: string
  cnpj: string | null
  endereco: string | null
  created_at: string
  updated_at: string
}

export interface ClientOverviewMachine {
  id: string
  serial_number: string
  product_type: ProductType
  type: MachineType
  status: MachineStatus
  returns_count: number
  updated_at: string
}

export interface ClientTimelineEvent {
  kind: 'DELIVERY' | 'RETURN'
  date: string
  machine_id: string
  serial_number: string
  description: string
}

export interface ClientOverview {
  client: Pick<Client, 'id' | 'nome' | 'cnpj' | 'endereco' | 'created_at'>
  summary: {
    totalMachines: number
    alugadas: number
    vendidas: number
    emRevisao: number
    totalDeliveries: number
    totalReturns: number
  }
  machines: ClientOverviewMachine[]
  events: ClientTimelineEvent[]
}
