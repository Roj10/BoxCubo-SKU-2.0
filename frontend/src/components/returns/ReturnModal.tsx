import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Machine } from '../../types/machine'
import type { ReturnCondition, ReturnDestination } from '../../types/return'
import Button from '../ui/Button'

interface ReturnModalProps {
  machine: Machine
  onClose: () => void
  onSuccess: () => void
}

export default function ReturnModal({ machine, onClose, onSuccess }: ReturnModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const [reason, setReason] = useState('')
  const [condition, setCondition] = useState<ReturnCondition | ''>('')
  const [destination, setDestination] = useState<ReturnDestination | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Motivo é obrigatório.')
      return
    }
    if (!condition) {
      setError('Selecione a condição da máquina.')
      return
    }
    if (!destination) {
      setError('Selecione o destino da máquina.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machine.id,
          reason: reason.trim(),
          condition,
          destination,
        }),
      })

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Não foi possível registrar a devolução.')
      }
    } catch {
      setError('Não foi possível registrar a devolução.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Registrar Devolução</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">{machine.serial_number}</p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="return-reason">
              Motivo
            </label>
            <textarea
              id="return-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
              placeholder="Ex: defeito na balança, troca de modelo..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="return-condition">
              Condição da máquina
            </label>
            <select
              id="return-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as ReturnCondition | '')}
              className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
            >
              <option value="">Selecione...</option>
              <option value="Boa">Boa</option>
              <option value="Com defeito">Com defeito</option>
              <option value="Danificada">Danificada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Destino
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDestination('ESTOQUE')}
                className={
                  destination === 'ESTOQUE'
                    ? 'flex-1 py-2 px-3 rounded border-2 border-brand-orange bg-orange-50 text-brand-orange font-semibold text-sm'
                    : 'flex-1 py-2 px-3 rounded border-2 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm hover:border-brand-orange transition-colors'
                }
              >
                Retornar ao estoque
              </button>
              <button
                type="button"
                onClick={() => setDestination('EM_REVISAO')}
                className={
                  destination === 'EM_REVISAO'
                    ? 'flex-1 py-2 px-3 rounded border-2 border-brand-orange bg-orange-50 text-brand-orange font-semibold text-sm'
                    : 'flex-1 py-2 px-3 rounded border-2 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm hover:border-brand-orange transition-colors'
                }
              >
                Enviar para revisão
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
