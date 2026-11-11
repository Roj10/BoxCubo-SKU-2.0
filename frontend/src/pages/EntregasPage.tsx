import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Search, Download, List, CalendarDays } from 'lucide-react'
import type { Delivery, DeliveryStatus } from '../types/delivery'
import type { Machine } from '../types/machine'
import { DELIVERY_STATUS_LABELS } from '../types/delivery'
import DeliverySummaryCards from '../components/deliveries/DeliverySummaryCards'
import DeliveryList from '../components/deliveries/DeliveryList'
import DeliveryCalendar from '../components/deliveries/DeliveryCalendar'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

export default function EntregasPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeliveryStatus>('ALL')
  const [advancingIds, setAdvancingIds] = useState<Set<string>>(new Set())
  const [rollingBackIds, setRollingBackIds] = useState<Set<string>>(new Set())
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const { showToast, ToastComponent } = useToast()

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  // Monta a URL de export anexando ?from=&to= apenas com valores preenchidos (vazio = exporta tudo)
  const buildExportUrl = () => {
    const params = new URLSearchParams()
    if (exportFrom) params.set('from', exportFrom)
    if (exportTo) params.set('to', exportTo)
    const qs = params.toString()
    return qs ? `/api/deliveries/export.csv?${qs}` : '/api/deliveries/export.csv'
  }

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/deliveries')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDeliveries(data)
      // Máquinas com prazo — plotadas no calendário como "Prazo"
      const resMachines = await fetch('/api/machines')
      if (resMachines.ok) setMachines(await resMachines.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const handleAdvance = async (id: string) => {
    setAdvancingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/deliveries/${id}/advance`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
      showToast('Status avançado.', 'success')
      await fetchDeliveries()
    } catch {
      showToast('Não foi possível atualizar a entrega.', 'error')
    } finally {
      setAdvancingIds(prev => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }

  const handleRollback = async (id: string) => {
    setRollingBackIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/deliveries/${id}/rollback`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
      showToast('Status recuado.', 'success')
      await fetchDeliveries()
    } catch {
      showToast('Não foi possível recuar a entrega.', 'error')
    } finally {
      setRollingBackIds(prev => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }

  const totalPending = deliveries.filter(d => d.status !== 'ENTREGUE').length
  const displayedDeliveries = (showAll ? deliveries : deliveries.filter(d => d.status !== 'ENTREGUE'))
    .filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const haystack = `${d.machine.serial_number} ${d.machine.client?.nome ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  const pendingLabel =
    totalPending === 0
      ? 'Nenhuma pendente'
      : totalPending === 1
      ? '1 pendente'
      : `${totalPending} pendentes`

  return (
    <div>
      {ToastComponent}

      {/* Page heading */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Entregas</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{pendingLabel}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">De</label>
            <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className={selectClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Até</label>
            <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className={selectClass} />
          </div>
          <a href={buildExportUrl()} download>
            <Button variant="ghost"><Download size={15} /> Exportar CSV</Button>
          </a>
        </div>
      </div>

      {/* Loading bar */}
      {loading && <LoadingBar />}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar as entregas.</p>
          <button
            onClick={fetchDeliveries}
            className="border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          <DeliverySummaryCards deliveries={deliveries} />

          {/* Alternância lista / calendário */}
          <div className="flex items-center gap-1 mb-3 bg-neutral-200 dark:bg-neutral-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                view === 'list' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              <List size={14} /> Lista
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                view === 'calendar' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              <CalendarDays size={14} /> Calendário
            </button>
          </div>

          {view === 'calendar' ? (
            <DeliveryCalendar deliveries={deliveries} machines={machines} />
          ) : (
          <>
          {/* Busca + filtro de status */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por N° série ou cliente..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectClass}>
              <option value="ALL">Todos os status</option>
              {Object.entries(DELIVERY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Filter toggle */}
          <div className="flex justify-end gap-2 mb-3">
            <Button
              variant={showAll ? 'primary' : 'ghost'}
              onClick={() => setShowAll(true)}
            >
              Ver todas
            </Button>
            <Button
              variant={!showAll ? 'primary' : 'ghost'}
              onClick={() => setShowAll(false)}
            >
              Só pendentes
            </Button>
          </div>

          <DeliveryList
            deliveries={displayedDeliveries}
            onAdvance={handleAdvance}
            onRollback={handleRollback}
            advancingIds={advancingIds}
            rollingBackIds={rollingBackIds}
          />
          </>
          )}
        </>
      )}
    </div>
  )
}
