import { Loader2, FileText } from 'lucide-react'
import type { Delivery } from '../../types/delivery'
import { DELIVERY_STATUS_LABELS } from '../../types/delivery'
import { printRomaneio } from '../../lib/romaneio'
import SortableHeader from '../ui/SortableHeader'
import { useSortableTable } from '../../hooks/useSortableTable'

interface DeliveryListProps {
  deliveries: Delivery[]
  onAdvance: (id: string) => void
  onRollback: (id: string) => void
  advancingIds: Set<string>
  rollingBackIds: Set<string>
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  AGUARDANDO_COLETA: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  ENTREGUE: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
}

export default function DeliveryList({
  deliveries,
  onAdvance,
  onRollback,
  advancingIds,
  rollingBackIds,
}: DeliveryListProps) {
  const { sorted, sortId, direction, requestSort } = useSortableTable(deliveries)

  if (deliveries.length === 0) {
    return (
      <p className="text-neutral-500 dark:text-neutral-400 text-sm py-8 text-center">Nenhuma entrega pendente.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 h-9">
            <SortableHeader label="N° Série" active={sortId === 'serial_number'} direction={direction} onClick={() => requestSort('serial_number', (d) => d.machine.serial_number ?? '', 'string')} />
            <SortableHeader label="Produto" active={sortId === 'product_type'} direction={direction} onClick={() => requestSort('product_type', (d) => d.machine.product_type, 'string')} />
            <SortableHeader label="Cliente" active={sortId === 'client'} direction={direction} onClick={() => requestSort('client', (d) => d.machine.client?.nome ?? '', 'string')} />
            <SortableHeader label="Transportadora" active={sortId === 'carrier'} direction={direction} onClick={() => requestSort('carrier', (d) => d.carrier, 'string')} />
            <SortableHeader label="Data Coleta" active={sortId === 'pickup_date'} direction={direction} onClick={() => requestSort('pickup_date', (d) => d.pickup_date, 'date')} />
            <SortableHeader label="Status" active={sortId === 'status'} direction={direction} onClick={() => requestSort('status', (d) => d.status, 'string')} />
            <th className="text-left px-4">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((delivery, index) => (
            <tr
              key={delivery.id}
              className={`text-sm border-b border-neutral-100 dark:border-neutral-700 ${index % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800'}`}
            >
              <td className="px-4 py-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                {delivery.machine.serial_number || 'Sem série'}
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                {delivery.machine.product_type}
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                {delivery.machine.client?.nome ?? '—'}
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                {delivery.carrier || '—'}
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                {delivery.pickup_date
                  ? new Date(delivery.pickup_date).toLocaleDateString('pt-BR')
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASSES[delivery.status] ?? ''}`}
                >
                  {DELIVERY_STATUS_LABELS[delivery.status]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {delivery.status !== 'ENTREGUE' && (
                    <button
                      className="text-xs px-2 py-1 rounded bg-brand-orange text-white font-semibold hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      disabled={advancingIds.has(delivery.id)}
                      onClick={() => onAdvance(delivery.id)}
                    >
                      {advancingIds.has(delivery.id) ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        'Marcar Entregue'
                      )}
                    </button>
                  )}
                  {delivery.status !== 'AGUARDANDO_COLETA' && (
                    <button
                      className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      disabled={rollingBackIds.has(delivery.id)}
                      onClick={() => onRollback(delivery.id)}
                    >
                      {rollingBackIds.has(delivery.id) ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        'Recuar'
                      )}
                    </button>
                  )}
                  <button
                    className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors inline-flex items-center gap-1"
                    title="Imprimir romaneio de entrega"
                    onClick={() => printRomaneio(delivery)}
                  >
                    <FileText size={12} /> Romaneio
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
