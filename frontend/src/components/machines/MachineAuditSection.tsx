import { useEffect, useState, useCallback } from 'react'
import { History } from 'lucide-react'
import type { AuditLog } from '../../types/audit'
import { ACTION_LABELS, ACTION_BADGE_CLASSES } from '../../types/audit'
import LoadingBar from '../ui/LoadingBar'

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR')

export default function MachineAuditSection({ machineId }: { machineId: string }) {
  const [events, setEvents] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchEvents = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/audit/machine/${machineId}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setEvents(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [machineId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  if (loading) return <LoadingBar />

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Não foi possível carregar as alterações.</p>
        <button
          onClick={fetchEvents}
          className="text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (events.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">Nenhuma alteração registrada.</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <History size={16} className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-medium ${ACTION_BADGE_CLASSES[e.action]}`}>
                {ACTION_LABELS[e.action]}
              </span>
              <span className="text-sm text-neutral-800 dark:text-neutral-200">{e.summary}</span>
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              {e.actor} · {fmt(e.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
