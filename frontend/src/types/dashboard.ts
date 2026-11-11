export type ProductKey = 'BOXCUBO_V2' | 'SLIM' | 'VISION' | 'EYE'

export interface StockByProduct {
  VENDA: number
  ALUGUEL: number
  ESTOQUE: number
}

export interface AvgTimes {
  avgProduction: string
  avgStay: string
}

export interface DashboardKpis {
  totalMachines: number
  aguardandoProducao: number
  emProducao: number
  prontoEnvio: number
  entregue: number
  emRevisao: number
  estoque: number
  alugadas: number
  vendidas: number
}

export interface LowMaterial {
  id: string
  name: string
  unit: string
  current: number
  full: number
  percent: number
}

export interface DashboardMaterials {
  total: number
  lowCount: number
  low: LowMaterial[]
}

export interface OperationMachine {
  id: string
  serial_number: string | null
  client: string | null
  deadline: string | null
}

export interface OperationMachines {
  aguardandoProducao: OperationMachine[]
  emProducao: OperationMachine[]
  prontoEnvio: OperationMachine[]
  entregue: OperationMachine[]
  emRevisao: OperationMachine[]
}

export interface DashboardData {
  stock: Record<ProductKey, StockByProduct>
  productionByStage: Record<string, number>
  deliveries: { aguardandoColeta: number; emTransito: number; entregue: number; total: number }
  returns: { emRevisao: number; totalHistorico: number }
  avgTimes: Record<ProductKey, AvgTimes>
  kpis: DashboardKpis
  materials: DashboardMaterials
  operationMachines?: OperationMachines
}
