import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Machine } from '../../types/machine'
import ProductBadge from '../ui/ProductBadge'
import TypeBadge from '../ui/TypeBadge'
import Button from '../ui/Button'

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_PRODUCAO: 'Aguardando Produção',
  EM_PRODUCAO: 'Em Produção',
  PRONTO_ENVIO: 'Pronto para Envio',
  ENTREGUE: 'Entregue',
  EM_REVISAO: 'Em Revisão',
}

interface SearchModalProps {
  machine: Machine
  onClose: () => void
}

export default function SearchModal({ machine, onClose }: SearchModalProps) {
  const navigate = useNavigate()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isV2 = machine.product_type === 'BOXCUBO_V2'

  return (
    <div
      className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-2xl relative">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div>
          <ProductBadge size="md" product={machine.product_type} />
          <p className="text-2xl font-semibold leading-none text-brand-dark dark:text-neutral-100 mt-2">{machine.serial_number}</p>
        </div>

        <hr className="border-neutral-200 dark:border-neutral-700 my-4" />

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Cliente</p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.client?.nome || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Tipo</p>
            <TypeBadge type={machine.type} />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Cadastrado por</p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.created_by}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Status</p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{STATUS_LABELS[machine.status] || machine.status}</p>
          </div>
          {isV2 && (
            <>
              <div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">MAC Address</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100 font-mono">{machine.mac_address || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Plano Suporte</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.support_plan ? 'Sim' : 'Não'}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button
            variant="ghost"
            onClick={() => {
              navigate(`/maquinas/${machine.id}`)
              onClose()
            }}
          >
            Ver detalhes →
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              navigate(`/estoque/${machine.id}/editar`)
              onClose()
            }}
          >
            Editar Máquina →
          </Button>
        </div>
      </div>
    </div>
  )
}
