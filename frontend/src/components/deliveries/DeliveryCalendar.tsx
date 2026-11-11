import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Delivery } from '../../types/delivery'
import type { Machine } from '../../types/machine'

interface DeliveryCalendarProps {
  deliveries: Delivery[]
  machines?: Machine[] // máquinas com prazo — plotadas como chips "Prazo"
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Datas são armazenadas como meia-noite UTC — extrai só a parte da data
// (converter via new Date() deslocaria o dia no fuso local)
function dateOnlyKey(iso: string): string {
  return iso.slice(0, 10)
}

// Texto do chip: "N° série | Empresa" — sem série vira "Sem série", sem cliente vira "BoxCubo"
function chipLabel(serial: string | null, client: string | null | undefined): string {
  return `${serial || 'Sem série'} | ${client || 'BoxCubo'}`
}

// Estilo do chip de entrega no dia: entregue (verde), atrasada (vermelho), prevista (azul)
function chipClass(delivery: Delivery, isPast: boolean): string {
  if (delivery.status === 'ENTREGUE') return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
  if (isPast) return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
  return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
}

export default function DeliveryCalendar({ deliveries, machines = [] }: DeliveryCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = dayKey(today)

  // Agrupa entregas por dia da data prevista
  const byDay = new Map<string, Delivery[]>()
  const undated: Delivery[] = []
  for (const d of deliveries) {
    if (!d.expected_date) {
      if (d.status !== 'ENTREGUE') undated.push(d)
      continue
    }
    const key = dateOnlyKey(d.expected_date)
    const list = byDay.get(key) ?? []
    list.push(d)
    byDay.set(key, list)
  }

  // Agrupa prazos de máquinas ainda não entregues (evita duplicar quem já tem entrega no calendário)
  const machinesWithDelivery = new Set(deliveries.filter((d) => d.expected_date).map((d) => d.machine_id))
  const deadlinesByDay = new Map<string, Machine[]>()
  for (const m of machines) {
    if (!m.deadline || m.status === 'ENTREGUE' || machinesWithDelivery.has(m.id)) continue
    const key = dateOnlyKey(m.deadline)
    const list = deadlinesByDay.get(key) ?? []
    list.push(m)
    deadlinesByDay.set(key, list)
  }

  // Monta a grade do mês: células anteriores vazias + dias do mês
  const firstWeekday = cursor.getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ]

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label="Mês anterior"
          className="w-8 h-8 flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 capitalize">{monthLabel}</p>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label="Próximo mês"
          className="w-8 h-8 flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200 dark:bg-neutral-700 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-neutral-50 dark:bg-neutral-800/60 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 text-center py-2">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="bg-neutral-50 dark:bg-neutral-800/50 min-h-[88px]" />
          const key = dayKey(date)
          const items = byDay.get(key) ?? []
          const deadlineItems = deadlinesByDay.get(key) ?? []
          const isToday = key === todayKey
          const isPast = date.getTime() < today.getTime()
          const total = items.length + deadlineItems.length
          return (
            <div key={key} className={`bg-white dark:bg-neutral-800 min-h-[88px] p-1.5 ${isToday ? 'ring-2 ring-inset ring-brand-orange' : ''}`}>
              <p className={`text-xs mb-1 ${isToday ? 'font-bold text-brand-orange' : 'text-neutral-400 dark:text-neutral-500'}`}>
                {date.getDate()}
              </p>
              <div className="space-y-1">
                {items.slice(0, 3).map((d) => (
                  <Link
                    key={d.id}
                    to={`/maquinas/${d.machine_id}`}
                    title={`${d.machine.serial_number ?? 'sem série'} · ${d.machine.client?.nome ?? 'sem cliente'} · ${d.carrier || 'sem transportadora'}`}
                    className={`block px-1.5 py-0.5 rounded text-[11px] font-medium truncate hover:opacity-80 transition-opacity ${chipClass(d, isPast)}`}
                  >
                    {chipLabel(d.machine.serial_number, d.machine.client?.nome)}
                  </Link>
                ))}
                {deadlineItems.slice(0, Math.max(0, 3 - items.length)).map((m) => (
                  <Link
                    key={m.id}
                    to={`/maquinas/${m.id}`}
                    title={`Prazo de entrega · ${m.serial_number ?? 'sem série'} · ${m.client?.nome ?? 'sem cliente'}`}
                    className={`block px-1.5 py-0.5 rounded text-[11px] font-medium truncate hover:opacity-80 transition-opacity ${
                      isPast
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        : 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-300'
                    }`}
                  >
                    {chipLabel(m.serial_number, m.client?.nome)}
                  </Link>
                ))}
                {total > 3 && (
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 px-1">+ {total - 3}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legenda com o mesmo estilo dos chips do calendário */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">Entrega prevista</span>
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-300">Prazo da máquina</span>
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">Atrasada</span>
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">Entregue</span>
      </div>

      {undated.length > 0 && (
        <div className="mt-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
            Entregas pendentes sem data prevista ({undated.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {undated.map((d) => (
              <Link
                key={d.id}
                to={`/maquinas/${d.machine_id}`}
                className="px-2 py-1 rounded-md text-xs font-mono font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                {chipLabel(d.machine.serial_number, d.machine.client?.nome)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
