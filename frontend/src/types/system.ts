import type { ProductType, MachineStatus } from './machine'

export interface BackupInfo {
  filename: string
  size: number
  created_at: string
}

export interface SystemInfo {
  dbSizeBytes: number
  uptimeSeconds: number
  nodeVersion: string
  backupsCount: number
  counts: {
    machines: number
    clients: number
    deliveries: number
    returns: number
    materials: number
    auditLogs: number
    productionStages: number
  }
}

export interface TrendWeek {
  label: string
  produced: number
  delivered: number
}

export interface ReturnReason {
  reason: string
  count: number
}

export interface RepeatOffender {
  id: string
  serial_number: string
  product_type: ProductType
  status: MachineStatus
  client: { id: string; nome: string } | null
  returns_count: number
}

export interface TrendsData {
  weeks: TrendWeek[]
  returnReasons: ReturnReason[]
  repeatOffenders: RepeatOffender[]
}

export type InsightLevel = 'info' | 'warn' | 'critical'

export interface Insight {
  level: InsightLevel
  text: string
  link?: string
}

export interface CapacityItem {
  product: ProductType
  capacity: number | null
  bottleneck: string | null
}

export interface InsightsData {
  insights: Insight[]
  capacity: CapacityItem[]
}

export interface ReportProducedItem {
  machine_id: string
  serial_number: string
  product_type: ProductType
  date: string
}

export interface ReportDeliveredItem {
  machine_id: string
  serial_number: string
  product_type: ProductType
  client: string | null
  carrier: string | null
  date: string
}

export interface ReportReturnItem {
  machine_id: string
  serial_number: string
  product_type: ProductType
  reason: string
  destination: string
  date: string
}

export interface ReportNewMachineItem {
  machine_id: string
  serial_number: string
  product_type: ProductType
  type: string
  created_by: string
  date: string
}

export interface PeriodReport {
  from: string
  to: string
  totals: {
    produced: number
    delivered: number
    returns: number
    newMachines: number
    started: number
  }
  produced: ReportProducedItem[]
  delivered: ReportDeliveredItem[]
  returns: ReportReturnItem[]
  newMachines: ReportNewMachineItem[]
}
