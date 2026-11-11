import { Loader2 } from 'lucide-react'
import type { Return } from '../../types/return'
import type { Machine } from '../../types/machine'
import { PRODUCT_LABELS } from '../../types/machine'

interface ReturnWithMachine extends Return {
  machine: Machine
}

interface ReturnReviewListProps {
  returns: ReturnWithMachine[]
  onCompleteReview: (machineId: string) => void
  completingIds: Set<string>
  showAll: boolean
}

export default function ReturnReviewList({
  returns,
  onCompleteReview,
  completingIds,
  showAll,
}: ReturnReviewListProps) {
  if (returns.length === 0) {
    return (
      <p className="text-neutral-500 dark:text-neutral-400 text-sm py-8 text-center">
        {showAll ? 'Nenhuma devolução registrada.' : 'Nenhuma máquina em revisão no momento.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 h-9">
            <th className="text-left px-4">N° Série</th>
            <th className="text-left px-4">Produto</th>
            <th className="text-left px-4">Cliente</th>
            <th className="text-left px-4">Data Devolução</th>
            <th className="text-left px-4">Motivo</th>
            <th className="text-left px-4">Condição</th>
            <th className="text-left px-4">Destino</th>
            <th className="text-left px-4">Ações</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((r, index) => (
            <tr
              key={r.id}
              className={`text-sm border-b border-neutral-100 dark:border-neutral-700 ${index % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800'}`}
            >
              <td className="px-4 py-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                {r.machine.serial_number}
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                {PRODUCT_LABELS[r.machine.product_type] ?? r.machine.product_type}
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                {r.machine.client?.nome ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </td>
              <td className="px-4 py-3 max-w-xs truncate text-sm text-neutral-600 dark:text-neutral-300">
                {r.reason}
              </td>
              <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                {r.condition}
              </td>
              <td className="px-4 py-3">
                {r.destination === 'ESTOQUE' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
                    Estoque
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                    Revisão
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {r.machine.status === 'EM_REVISAO' ? (
                  <button
                    className="text-xs px-2 py-1 rounded bg-brand-orange text-white font-semibold hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    disabled={completingIds.has(r.machine_id)}
                    onClick={() => onCompleteReview(r.machine_id)}
                  >
                    {completingIds.has(r.machine_id) ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      'Concluir Revisão'
                    )}
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
