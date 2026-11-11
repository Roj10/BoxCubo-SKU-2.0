import type { LucideIcon } from 'lucide-react'
import { PlusCircle, Play, CheckCircle2, Truck, RotateCcw } from 'lucide-react'
import type { MachineDetail } from '../../types/machine'
import { STAGE_LABELS } from '../../types/production'
import { DELIVERY_STATUS_LABELS } from '../../types/delivery'
import { RETURN_CONDITION_LABELS, RETURN_DESTINATION_LABELS } from '../../types/return'

interface TimelineEvent {
  date: string
  icon: LucideIcon
  label: string
  detail: string
}

function buildEvents(machine: MachineDetail): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    date: machine.created_at,
    icon: PlusCircle,
    label: 'Máquina cadastrada',
    detail: `Cadastrada por ${machine.created_by}`,
  })

  for (const stage of machine.production_stages) {
    events.push({
      date: stage.started_at,
      icon: Play,
      label: `Início — ${STAGE_LABELS[stage.stage]}`,
      detail: '',
    })
    if (stage.completed_at) {
      events.push({
        date: stage.completed_at,
        icon: CheckCircle2,
        label: `Concluído — ${STAGE_LABELS[stage.stage]}`,
        detail: '',
      })
    }
  }

  for (const delivery of machine.deliveries) {
    const carrier = delivery.carrier ? ` — Transportadora: ${delivery.carrier}` : ''
    events.push({
      date: delivery.created_at,
      icon: Truck,
      label: 'Entrega registrada',
      detail: `Status: ${DELIVERY_STATUS_LABELS[delivery.status]}${carrier}`,
    })
  }

  for (const ret of machine.returns) {
    events.push({
      date: ret.created_at,
      icon: RotateCcw,
      label: 'Devolução registrada',
      detail: `${RETURN_CONDITION_LABELS[ret.condition]} — ${RETURN_DESTINATION_LABELS[ret.destination]} — Motivo: ${ret.reason}`,
    })
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

interface MachineTimelineProps {
  machine: MachineDetail
}

export default function MachineTimeline({ machine }: MachineTimelineProps) {
  const events = buildEvents(machine)

  return (
    <ol className="relative border-l border-neutral-200 dark:border-neutral-700 ml-3">
      {events.map((ev, i) => {
        const Icon = ev.icon
        return (
          <li key={i} className="mb-6 ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white text-brand-orange dark:bg-neutral-800 dark:ring-neutral-800">
              <Icon size={16} />
            </span>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{ev.label}</p>
            <time className="block text-xs text-neutral-500 dark:text-neutral-400">
              {new Date(ev.date).toLocaleString('pt-BR')}
            </time>
            {ev.detail && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{ev.detail}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
