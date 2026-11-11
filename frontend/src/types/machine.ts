import type { ProductionStage } from './production'
import type { Delivery } from './delivery'
import type { Return } from './return'

export type ProductType = 'BOXCUBO_V2' | 'SLIM' | 'VISION' | 'EYE'
// Aba de produto nas listagens: um produto específico ou todos
export type ProductTab = ProductType | 'TODOS'
export type MachineType = 'VENDA' | 'ALUGUEL' | 'ESTOQUE'
export type MachineStatus = 'AGUARDANDO_PRODUCAO' | 'EM_PRODUCAO' | 'PRONTO_ENVIO' | 'ENTREGUE' | 'EM_REVISAO'

export interface Machine {
  id: string
  serial_number: string | null
  product_type: ProductType
  mac_address: string | null
  support_plan: boolean
  camera: boolean
  type: MachineType
  status: MachineStatus
  deadline: string | null
  created_by: string
  client_id: string | null
  client: { id: string; nome: string } | null
  created_at: string
  updated_at: string
}

export interface MachineDetail extends Machine {
  production_stages: ProductionStage[]
  deliveries: Delivery[]
  returns: Return[]
}

export const PRODUCT_LABELS: Record<ProductType, string> = {
  BOXCUBO_V2: 'BoxCubo V2',
  SLIM: 'Slim',
  VISION: 'Vision',
  EYE: 'EYE',
}

// Nomes da equipe: vêm do frontend/.env (VITE_EQUIPE, separados por vírgula), para não ficarem no código.
export const TEAM_MEMBERS: string[] = (import.meta.env.VITE_EQUIPE ?? '').split(',').map((n) => n.trim()).filter(Boolean)

// Formato do N° de série por produto: prefixo + exatamente 5 números
export const SERIAL_RULES: Record<ProductType, { prefix: string; pattern: RegExp; example: string }> = {
  BOXCUBO_V2: { prefix: 'BC', pattern: /^BC\d{5}$/, example: 'BC12345' },
  SLIM: { prefix: 'BCS', pattern: /^BCS\d{5}$/, example: 'BCS12345' },
  VISION: { prefix: 'BCV', pattern: /^BCV\d{5}$/, example: 'BCV12345' },
  EYE: { prefix: 'BCE', pattern: /^BCE\d{5}$/, example: 'BCE12345' },
}
