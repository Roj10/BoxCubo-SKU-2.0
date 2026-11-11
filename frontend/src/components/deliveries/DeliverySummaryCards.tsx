import { Package, CheckCircle } from 'lucide-react'
import type { Delivery } from '../../types/delivery'

interface DeliverySummaryCardsProps {
  deliveries: Delivery[]
}

export default function DeliverySummaryCards({ deliveries }: DeliverySummaryCardsProps) {
  const aguardandoCount = deliveries.filter(d => d.status === 'AGUARDANDO_COLETA').length
  const entregueCount = deliveries.filter(d => d.status === 'ENTREGUE').length

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Package size={13} className="text-amber-500" /> Aguardando coleta
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{aguardandoCount}</p>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <CheckCircle size={13} className="text-emerald-600" /> Entregues
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{entregueCount}</p>
      </div>
    </div>
  )
}
