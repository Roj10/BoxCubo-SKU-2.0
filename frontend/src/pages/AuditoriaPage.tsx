import { useState, useEffect, useCallback } from 'react'
import { Search, History } from 'lucide-react'
import type { AuditLog, AuditAction, AuditEntityType } from '../types/audit'
import { ACTION_LABELS, ENTITY_LABELS, ACTION_BADGE_CLASSES } from '../types/audit'
import LoadingBar from '../components/ui/LoadingBar'

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR')

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<'ALL' | AuditEntityType>('ALL')
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditAction>('ALL')

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  // Estratégia: busca tudo (limit alto) numa requisição e filtra no cliente
  // (entidade, ação e busca textual), seguindo o padrão da MateriaisPage.
  const fetchEvents = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/audit?limit=500')
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
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const filtered = events.filter((e) => {
    if (entityFilter !== 'ALL' && e.entity_type !== entityFilter) return false
    if (actionFilter !== 'ALL' && e.action !== actionFilter) return false
    if (search.trim() && !e.summary.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  const entityOptions = Object.keys(ENTITY_LABELS) as AuditEntityType[]
  const actionOptions = Object.keys(ACTION_LABELS) as AuditAction[]

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Auditoria</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {filtered.length} {filtered.length === 1 ? 'evento' : 'eventos'}
        </p>
      </div>

      {loading && <LoadingBar />}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Não foi possível carregar os eventos de auditoria.</p>
          <button
            onClick={fetchEvents}
            className="text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
          <History size={44} className="text-neutral-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Nenhum evento de auditoria ainda.</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <>
          {/* Busca + filtros */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar no resumo..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value as 'ALL' | AuditEntityType)} className={selectClass}>
              <option value="ALL">Todas as entidades</option>
              {entityOptions.map((et) => (
                <option key={et} value={et}>{ENTITY_LABELS[et]}</option>
              ))}
            </select>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as 'ALL' | AuditAction)} className={selectClass}>
              <option value="ALL">Todas as ações</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">Nenhum evento corresponde aos filtros.</p>
          ) : (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700">
                    <th className="px-4 py-2.5 font-medium w-44">Data/Hora</th>
                    <th className="px-4 py-2.5 font-medium w-28">Entidade</th>
                    <th className="px-4 py-2.5 font-medium w-40">Ação</th>
                    <th className="px-4 py-2.5 font-medium">Resumo</th>
                    <th className="px-4 py-2.5 font-medium w-36">Autor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-700/40">
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">{fmt(e.created_at)}</td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">{ENTITY_LABELS[e.entity_type]}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${ACTION_BADGE_CLASSES[e.action]}`}>
                          {ACTION_LABELS[e.action]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200">{e.summary}</td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{e.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
