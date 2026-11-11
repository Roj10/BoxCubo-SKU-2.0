import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { Alert, AlertType, AlertSeverity, AlertsResponse } from '../../types/alert'
import { ALERT_TYPE_LABELS } from '../../types/alert'

const TYPE_ORDER: AlertType[] = ['ENTREGA_ATRASADA', 'MAQUINA_PARADA', 'REVISAO_PENDENTE', 'MATERIAL_BAIXO']

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  alta: 'border-l-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
  media: 'border-l-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  baixa: 'border-l-neutral-300 dark:border-l-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50',
}

const SEVERITY_TITLE_COLOR: Record<AlertSeverity, string> = {
  alta: 'text-red-700 dark:text-red-400',
  media: 'text-amber-700 dark:text-amber-400',
  baixa: 'text-neutral-800 dark:text-neutral-200',
}

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts')
      if (!res.ok) return
      const data: AlertsResponse = await res.json()
      setAlerts(data.alerts ?? [])
      setCount(data.count ?? 0)
    } catch {
      // falha silenciosa — não quebra o header
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, 60_000)
    return () => clearInterval(id)
  }, [fetchAlerts])

  useEffect(() => {
    if (open) fetchAlerts()
  }, [open, fetchAlerts])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: alerts.filter((a) => a.type === type) }))
    .filter((g) => g.items.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        title="Notificações"
        className="relative p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none tabular-nums">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Notificações</h3>
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Nenhum alerta no momento.
            </div>
          ) : (
            <div className="py-1">
              {grouped.map((group) => (
                <div key={group.type}>
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {ALERT_TYPE_LABELS[group.type]}
                    </span>
                    <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tabular-nums">
                      {group.items.length}
                    </span>
                  </div>
                  {group.items.map((alert) => (
                    <Link
                      key={alert.id}
                      to={alert.link}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-2 border-l-4 transition-colors ${SEVERITY_STYLES[alert.severity]}`}
                    >
                      <p className={`text-sm font-semibold ${SEVERITY_TITLE_COLOR[alert.severity]}`}>{alert.title}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{alert.detail}</p>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
