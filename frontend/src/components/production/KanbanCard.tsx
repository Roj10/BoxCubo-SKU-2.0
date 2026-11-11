import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, X, GripVertical } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { MachineWithStage } from '../../types/production'
import { deadlineInfo } from '../../lib/deadline'
import ProductBadge from '../ui/ProductBadge'

interface KanbanCardProps {
  machine: MachineWithStage
  onAdvance: (machineId: string) => Promise<void>
  onRollback: (machineId: string) => Promise<void>
  onCancel: (machineId: string) => Promise<void>
}

const formatStageDate = (dateStr: string) => {
  return 'desde ' + new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export default function KanbanCard({ machine, onAdvance, onRollback, onCancel }: KanbanCardProps) {
  const [loading, setLoading] = useState<'advance' | 'rollback' | 'cancel' | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: machine.id })

  const currentStage = machine.production_stages[0]
  const isFirstStage = currentStage?.stage === 'RECEBIMENTO'
  const isLastStage = currentStage?.stage === 'EMBALAGEM'

  const handleAdvance = async () => {
    if (loading) return
    setLoading('advance')
    try {
      await onAdvance(machine.id)
    } finally {
      setLoading(null)
    }
  }

  const handleRollback = async () => {
    if (loading) return
    setLoading('rollback')
    try {
      await onRollback(machine.id)
    } finally {
      setLoading(null)
    }
  }

  const handleCancel = async () => {
    if (loading) return
    setLoading('cancel')
    try {
      await onCancel(machine.id)
    } finally {
      setLoading(null)
      setConfirmingCancel(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`bg-white dark:bg-neutral-800 rounded-md p-3 border border-neutral-200/70 dark:border-neutral-700/60 animate-card-in ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Top row: alça de arraste + ProductBadge + date */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <button
            {...listeners}
            aria-label="Arrastar para mover de etapa"
            className="touch-none cursor-grab active:cursor-grabbing text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors -ml-1"
          >
            <GripVertical size={16} />
          </button>
          <ProductBadge product={machine.product_type} size="sm" />
        </div>
        {currentStage && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{formatStageDate(currentStage.started_at)}</span>
        )}
      </div>

      {/* N° série + cliente — clicáveis, levam ao detalhe da máquina */}
      <Link to={`/maquinas/${machine.id}`} className="block group" title="Ver detalhes da máquina">
        <p className={`text-sm font-semibold group-hover:text-brand-orange group-hover:underline transition-colors ${machine.serial_number ? 'text-neutral-900 dark:text-neutral-100' : 'italic text-neutral-400 dark:text-neutral-500'}`}>
          {machine.serial_number || 'Sem série'}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{machine.client?.nome ?? '—'}</p>
      </Link>

      {/* Prazo de entrega */}
      {(() => {
        const info = deadlineInfo(machine.deadline, machine.status)
        if (!info) return null
        return (
          <p className={`text-xs mt-1 ${info.cls}`}>
            Prazo: {info.label}
            {info.badge && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${info.badge === 'Atrasado' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                {info.badge}
              </span>
            )}
          </p>
        )
      })()}

      {/* Cancel — confirmação inline em dois passos (ação irreversível) */}
      {!confirmingCancel ? (
        <button
          onClick={() => setConfirmingCancel(true)}
          disabled={!!loading}
          title="Cancelar produção e devolver ao estoque"
          className="mt-2 flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={11} />
          Cancelar produção
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-red-600 font-medium">Cancelar mesmo?</span>
          <button
            onClick={handleCancel}
            disabled={!!loading}
            className="px-2 py-0.5 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {loading === 'cancel' ? <Loader2 size={11} className="animate-spin" /> : 'Sim'}
          </button>
          <button
            onClick={() => setConfirmingCancel(false)}
            disabled={!!loading}
            className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors disabled:opacity-60"
          >
            Não
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-2">
        {/* Voltar — invisible on RECEBIMENTO to preserve layout height */}
        <button
          onClick={handleRollback}
          disabled={!!loading}
          aria-label={`Voltar ${machine.product_type} ${machine.serial_number} para etapa anterior`}
          className={`border border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 px-3 py-1 rounded text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1${isFirstStage ? ' invisible' : ''}`}
        >
          {loading === 'rollback' ? <Loader2 size={12} className="animate-spin" /> : 'Voltar'}
        </button>

        {/* Avançar / Concluir Produção */}
        <button
          onClick={handleAdvance}
          disabled={!!loading}
          aria-label={`Avançar ${machine.product_type} ${machine.serial_number} para próxima etapa`}
          className="bg-brand-orange text-white px-3 py-1 rounded text-xs font-semibold hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          {loading === 'advance'
            ? <Loader2 size={12} className="animate-spin" />
            : (isLastStage ? 'Concluir Produção' : 'Avançar')}
        </button>
      </div>
    </div>
  )
}
