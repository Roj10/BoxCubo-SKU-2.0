import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { STAGES } from '../../types/production'
import type { Stage, MachineWithStage } from '../../types/production'
import KanbanColumn from './KanbanColumn'
import ProductBadge from '../ui/ProductBadge'

interface KanbanBoardProps {
  machines: MachineWithStage[]
  onAdvance: (machineId: string) => Promise<void>
  onRollback: (machineId: string) => Promise<void>
  onCancel: (machineId: string) => Promise<void>
  onMove: (machineId: string, fromStage: Stage, toStage: Stage) => Promise<void>
}

export default function KanbanBoard({ machines, onAdvance, onRollback, onCancel, onMove }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Pequena distância de ativação: cliques nos botões continuam funcionando; só arrasta após mover ~6px
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = machines.filter(m => m.production_stages[0]?.stage === stage)
    return acc
  }, {} as Record<Stage, MachineWithStage[]>)

  const activeMachine = activeId ? machines.find(m => m.id === activeId) ?? null : null
  const activeStage = activeMachine?.production_stages[0]?.stage ?? null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const machine = machines.find(m => m.id === String(active.id))
    const fromStage = machine?.production_stages[0]?.stage
    const toStage = over.id as Stage

    if (!fromStage || !STAGES.includes(toStage) || fromStage === toStage) return
    onMove(String(active.id), fromStage, toStage)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <section aria-label="Painel de produção">
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
          Arraste um card pela alça para avançar (→) ou voltar (←) de etapa, ou use os botões.
        </p>
        <div className="overflow-x-auto w-full">
          <div className="flex flex-row gap-4 min-h-[calc(100vh-180px)]">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                machines={grouped[stage]}
                activeStage={activeStage}
                onAdvance={onAdvance}
                onRollback={onRollback}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Card "flutuante" enquanto arrasta */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeMachine ? (
          <div className="bg-white dark:bg-neutral-800 rounded-md p-3 shadow-2xl border border-brand-orange w-[204px] rotate-3 cursor-grabbing">
            <div className="mb-2">
              <ProductBadge product={activeMachine.product_type} size="sm" />
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{activeMachine.serial_number}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{activeMachine.client?.nome ?? '—'}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
