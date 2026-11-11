import { useDroppable } from '@dnd-kit/core'
import { STAGES } from '../../types/production'
import type { Stage, MachineWithStage } from '../../types/production'
import { STAGE_LABELS } from '../../types/production'
import KanbanCard from './KanbanCard'

// Progresso da etapa indicado por um único dot que esquenta em direção à marca
const STAGE_DOT: Record<Stage, string> = {
  RECEBIMENTO: 'bg-neutral-400',
  MONTAGEM: 'bg-brand-300',
  FLASH_FIRMWARE: 'bg-brand-400',
  TESTE: 'bg-brand-500',
  EMBALAGEM: 'bg-brand-600',
}

interface KanbanColumnProps {
  stage: Stage
  machines: MachineWithStage[]
  activeStage: Stage | null
  onAdvance: (machineId: string) => Promise<void>
  onRollback: (machineId: string) => Promise<void>
  onCancel: (machineId: string) => Promise<void>
}

export default function KanbanColumn({ stage, machines, activeStage, onAdvance, onRollback, onCancel }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  const isDragging = activeStage !== null
  const isSelf = activeStage === stage
  const fromIdx = activeStage ? STAGES.indexOf(activeStage) : -1
  const myIdx = STAGES.indexOf(stage)
  const isForward = isDragging && myIdx > fromIdx
  const isValidTarget = isDragging && !isSelf

  // Destaque da coluna: sólido quando o card está sobre ela; suave nas demais zonas válidas
  let highlight = ''
  if (isOver && isValidTarget) {
    highlight = isForward
      ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
      : 'ring-2 ring-inset ring-amber-400 bg-amber-50 dark:bg-amber-500/10'
  } else if (isValidTarget) {
    highlight = 'ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700'
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-neutral-100 dark:bg-neutral-900 rounded-lg min-w-[220px] flex-shrink-0 transition-all duration-150 ${highlight}`}
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[stage]}`} />
          {STAGE_LABELS[stage]}
        </h2>
        <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
          {machines.length}
        </span>
      </div>

      {/* Card list */}
      <div
        className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]"
        aria-label={machines.length === 0 ? `Coluna ${STAGE_LABELS[stage]}: nenhuma máquina` : undefined}
      >
        {machines.length === 0 ? (
          <p className={`text-center text-xs py-4 transition-colors ${isOver && isValidTarget ? 'text-neutral-600 dark:text-neutral-300 font-medium' : 'text-neutral-400 dark:text-neutral-500'}`}>
            {isOver && isValidTarget ? 'Soltar aqui' : 'Vazio'}
          </p>
        ) : (
          machines.map(machine => (
            <KanbanCard
              key={machine.id}
              machine={machine}
              onAdvance={onAdvance}
              onRollback={onRollback}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </div>
  )
}
