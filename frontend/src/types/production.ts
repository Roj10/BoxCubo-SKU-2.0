import type { Machine } from './machine'

export const STAGES = ['RECEBIMENTO', 'MONTAGEM', 'FLASH_FIRMWARE', 'TESTE', 'EMBALAGEM'] as const
export type Stage = typeof STAGES[number]

export const STAGE_LABELS: Record<Stage, string> = {
  RECEBIMENTO: 'ANÁLISE',
  MONTAGEM: 'MONTAGEM',
  FLASH_FIRMWARE: 'FLASH/FIRMWARE',
  TESTE: 'TESTE',
  EMBALAGEM: 'EMBALAGEM',
}

export interface ProductionStage {
  id: string
  machine_id: string
  stage: Stage
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface MachineWithStage extends Machine {
  production_stages: ProductionStage[]
}
