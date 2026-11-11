import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Machine } from '../../types/machine'
import type { Delivery } from '../../types/delivery'
import { DELIVERY_STATUS_LABELS } from '../../types/delivery'
import Button from '../ui/Button'

interface DeliveryHistoryModalProps {
  machine: Machine
  onClose: () => void
}

export default function DeliveryHistoryModal({ machine, onClose }: DeliveryHistoryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    fetch(`/api/deliveries/machine/${machine.id}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: Delivery[]) => {
        setDeliveries(data)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })

    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, machine.id])

  return (
    <div
      className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative max-h-[80vh] overflow-y-auto">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Histórico de Entregas</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">{machine.serial_number}</p>
        </div>

        {loading && (
          <div className="h-1 bg-brand-orange animate-pulse w-full mb-4" />
        )}

        {error && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">Não foi possível carregar o histórico.</p>
        )}

        {!loading && !error && deliveries.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">Nenhuma entrega registrada para esta máquina.</p>
        )}

        {!loading && !error && deliveries.length > 0 && (
          <div className="flex flex-col gap-0">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="flex gap-3 items-start pb-4 border-l-2 border-neutral-200 dark:border-neutral-700 pl-4 relative">
                <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-brand-orange" />
                <div className="flex flex-col gap-0.5 text-sm">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {DELIVERY_STATUS_LABELS[delivery.status]}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-300">
                    Transportadora: {delivery.carrier || '—'}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-300">
                    Data de coleta:{' '}
                    {delivery.pickup_date
                      ? new Date(delivery.pickup_date).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                  <p className="text-neutral-400 dark:text-neutral-500 text-xs">
                    Registrado em: {new Date(delivery.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  )
}
