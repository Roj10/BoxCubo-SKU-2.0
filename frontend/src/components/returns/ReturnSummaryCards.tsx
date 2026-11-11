import { Wrench, CheckCircle } from 'lucide-react'
import type { Return } from '../../types/return'
import type { Machine } from '../../types/machine'

interface ReturnWithMachine extends Return {
  machine: Machine
}

interface ReturnSummaryCardsProps {
  returns: ReturnWithMachine[]
}

export default function ReturnSummaryCards({ returns }: ReturnSummaryCardsProps) {
  const emRevisaoCount = returns.filter(r => r.machine.status === 'EM_REVISAO').length
  const retornaramCount = returns.filter(r => r.destination === 'ESTOQUE').length

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Wrench size={13} className="text-amber-500" /> Em revisão
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{emRevisaoCount}</p>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <CheckCircle size={13} className="text-emerald-600" /> Retornaram ao estoque
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{retornaramCount}</p>
      </div>
    </div>
  )
}
