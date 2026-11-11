import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Machine } from '../../types/machine'
import type { Delivery } from '../../types/delivery'
import type { Client } from '../../types/client'
import Button from '../ui/Button'

interface DeliveryModalProps {
  machine: Machine
  onClose: () => void
  onSuccess: () => void
}

export default function DeliveryModal({ machine, onClose, onSuccess }: DeliveryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const [carrier, setCarrier] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingDraft, setFetchingDraft] = useState(true)
  const [existingDeliveryId, setExistingDeliveryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saleType, setSaleType] = useState<'VENDA' | 'ALUGUEL' | ''>(
    machine.type === 'VENDA' || machine.type === 'ALUGUEL' ? machine.type : ''
  )
  const [clientId, setClientId] = useState(machine.client_id ?? '')
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    // Lista de clientes para vincular na saída
    fetch('/api/clients')
      .then((r) => r.json())
      .then((data: Client[]) => setClients(data))
      .catch(() => { /* ignore */ })

    // Buscar rascunho existente
    fetch(`/api/deliveries/machine/${machine.id}`)
      .then((r) => r.json())
      .then((data: Delivery[]) => {
        const draft = data.find((d) => d.status === 'AGUARDANDO_COLETA')
        if (draft) {
          setExistingDeliveryId(draft.id)
          setCarrier(draft.carrier)
          setPickupDate(draft.pickup_date ? draft.pickup_date.slice(0, 10) : '')
          setExpectedDate(draft.expected_date ? draft.expected_date.slice(0, 10) : '')
        }
      })
      .catch(() => {
        // silently ignore — user can still submit fresh
      })
      .finally(() => {
        setFetchingDraft(false)
      })

    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, machine.id])

  const handleSubmit = async () => {
    setError(null)
    if (!saleType) {
      setError('Selecione se a saída é Venda ou Aluguel.')
      return
    }
    if (!carrier.trim() || !pickupDate) {
      setError('Preencha a transportadora e a data de coleta.')
      return
    }

    setLoading(true)
    try {
      let response: Response
      if (existingDeliveryId) {
        response = await fetch(`/api/deliveries/${existingDeliveryId}/register`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carrier: carrier.trim(), pickup_date: pickupDate, expected_date: expectedDate || null, machine_type: saleType, client_id: clientId || null }),
        })
      } else {
        response = await fetch('/api/deliveries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machine_id: machine.id, carrier: carrier.trim(), pickup_date: pickupDate, expected_date: expectedDate || null, machine_type: saleType, client_id: clientId || null }),
        })
      }

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        setError('Não foi possível registrar o envio.')
      }
    } catch {
      setError('Não foi possível registrar o envio.')
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
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Registrar Envio</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">{machine.serial_number}</p>
        </div>

        {fetchingDraft ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Tipo de saída
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSaleType('VENDA')}
                  className={
                    saleType === 'VENDA'
                      ? 'flex-1 py-2 px-3 rounded border-2 border-brand-orange bg-orange-50 dark:bg-brand-orange/10 text-brand-orange font-semibold text-sm'
                      : 'flex-1 py-2 px-3 rounded border-2 border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm hover:border-brand-orange transition-colors'
                  }
                >
                  Venda
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType('ALUGUEL')}
                  className={
                    saleType === 'ALUGUEL'
                      ? 'flex-1 py-2 px-3 rounded border-2 border-brand-orange bg-orange-50 dark:bg-brand-orange/10 text-brand-orange font-semibold text-sm'
                      : 'flex-1 py-2 px-3 rounded border-2 border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm hover:border-brand-orange transition-colors'
                  }
                >
                  Aluguel
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="delivery-client">
                Cliente
              </label>
              <select
                id="delivery-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option value="">Sem cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="carrier">
                Transportadora
              </label>
              <input
                id="carrier"
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="Nome da transportadora"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="pickup-date">
                Data de coleta
              </label>
              <input
                id="pickup-date"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                max="2100-12-31"
                className="w-full border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="expected-date">
                Data prevista de entrega
              </label>
              <input
                id="expected-date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                max="2100-12-31"
                className="w-full border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mt-3">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || fetchingDraft}
            loading={loading}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  )
}
