import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Machine } from '../../types/machine'
import type { Return } from '../../types/return'
import Button from '../ui/Button'

interface ReturnHistoryModalProps {
  machine: Machine
  onClose: () => void
}

export default function ReturnHistoryModal({ machine, onClose }: ReturnHistoryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    fetch(`/api/returns/machine/${machine.id}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: Return[]) => {
        setReturns(data)
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
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Histórico de Devoluções</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">{machine.serial_number}</p>
        </div>

        {loading && (
          <div className="h-1 bg-brand-orange animate-pulse w-full my-4 rounded" />
        )}

        {error && (
          <p className="text-red-600 text-sm">Não foi possível carregar o histórico.</p>
        )}

        {!loading && !error && returns.length === 0 && (
          <p className="text-neutral-500 dark:text-neutral-400 text-sm py-4">Nenhuma devolução registrada para esta máquina.</p>
        )}

        {!loading && !error && returns.length > 0 && (
          <div>
            {returns.map((r) => (
              <div key={r.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mb-3 bg-neutral-50 dark:bg-neutral-800">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  {r.destination === 'ESTOQUE' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
                      Retornou ao estoque
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      Em revisão
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">Motivo: {r.reason}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Condição: {r.condition}</p>
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
