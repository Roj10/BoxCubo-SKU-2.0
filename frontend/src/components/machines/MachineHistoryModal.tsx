import { useState, useEffect, useRef } from 'react'
import { X, Truck, RotateCcw } from 'lucide-react'
import type { Machine } from '../../types/machine'
import type { Delivery } from '../../types/delivery'
import type { Return } from '../../types/return'
import { DELIVERY_STATUS_LABELS } from '../../types/delivery'
import Button from '../ui/Button'

interface MachineHistoryModalProps {
  machine: Machine
  onClose: () => void
}

type HistoryEvent =
  | { kind: 'delivery'; date: string; delivery: Delivery }
  | { kind: 'return'; date: string; ret: Return }

// Histórico unificado: entregas e devoluções da máquina numa única linha do tempo
export default function MachineHistoryModal({ machine, onClose }: MachineHistoryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    Promise.all([
      fetch(`/api/deliveries/machine/${machine.id}`).then((r) => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<Delivery[]>
      }),
      fetch(`/api/returns/machine/${machine.id}`).then((r) => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<Return[]>
      }),
    ])
      .then(([deliveries, returns]) => {
        const merged: HistoryEvent[] = [
          ...deliveries.map((d): HistoryEvent => ({ kind: 'delivery', date: d.created_at, delivery: d })),
          ...returns.map((r): HistoryEvent => ({ kind: 'return', date: r.created_at, ret: r })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setEvents(merged)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))

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
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Histórico da Máquina</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">{machine.serial_number || 'Sem série'}</p>
        </div>

        {loading && <div className="h-1 bg-brand-orange animate-pulse w-full mb-4 rounded" />}

        {error && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">Não foi possível carregar o histórico.</p>
        )}

        {!loading && !error && events.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">Nenhuma entrega ou devolução registrada para esta máquina.</p>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="flex flex-col gap-0">
            {events.map((ev, i) => (
              <div key={i} className="flex gap-3 items-start pb-4 border-l-2 border-neutral-200 dark:border-neutral-700 pl-4 relative">
                <div className={`absolute -left-1.5 top-1 w-3 h-3 rounded-full ${ev.kind === 'delivery' ? 'bg-brand-orange' : 'bg-red-500'}`} />
                {ev.kind === 'delivery' ? (
                  <div className="flex flex-col gap-0.5 text-sm">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 inline-flex items-center gap-1.5">
                      <Truck size={14} className="text-brand-orange" /> Entrega — {DELIVERY_STATUS_LABELS[ev.delivery.status]}
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-300">Transportadora: {ev.delivery.carrier || '—'}</p>
                    <p className="text-neutral-600 dark:text-neutral-300">
                      Data de coleta: {ev.delivery.pickup_date ? new Date(ev.delivery.pickup_date).toLocaleDateString('pt-BR') : '—'}
                    </p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">
                      Registrado em: {new Date(ev.delivery.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 text-sm">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 inline-flex items-center gap-1.5">
                      <RotateCcw size={14} className="text-red-500" /> Devolução
                      {ev.ret.destination === 'ESTOQUE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
                          Retornou ao estoque
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                          Em revisão
                        </span>
                      )}
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-300">Motivo: {ev.ret.reason}</p>
                    <p className="text-neutral-600 dark:text-neutral-300">Condição: {ev.ret.condition}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">
                      Registrado em: {new Date(ev.ret.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
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
