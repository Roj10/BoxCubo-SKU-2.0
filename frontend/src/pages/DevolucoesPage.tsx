import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Search } from 'lucide-react'
import type { Return, ReturnDestination } from '../types/return'
import { RETURN_DESTINATION_LABELS } from '../types/return'
import type { Machine } from '../types/machine'
import ReturnSummaryCards from '../components/returns/ReturnSummaryCards'
import ReturnReviewList from '../components/returns/ReturnReviewList'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

interface ReturnWithMachine extends Return {
  machine: Machine
}

export default function DevolucoesPage() {
  const [returns, setReturns] = useState<ReturnWithMachine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReturnDestination>('ALL')
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const { showToast, ToastComponent } = useToast()

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const url = showAll ? '/api/returns' : '/api/returns?status=EM_REVISAO'
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReturns(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [showAll])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  const handleCompleteReview = async (machineId: string) => {
    setCompletingIds(prev => new Set(prev).add(machineId))
    try {
      const res = await fetch('/api/returns/complete/' + machineId, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Não foi possível concluir a revisão.', 'error')
        return
      }
      showToast('Revisão concluída. Máquina pronta para envio no estoque.', 'success')
      await fetchReturns()
    } catch {
      showToast('Não foi possível concluir a revisão.', 'error')
    } finally {
      setCompletingIds(prev => {
        const s = new Set(prev)
        s.delete(machineId)
        return s
      })
    }
  }

  const emRevisaoCount = returns.filter(r => r.machine.status === 'EM_REVISAO').length

  const filteredReturns = returns.filter((r) => {
    if (statusFilter !== 'ALL' && r.destination !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${r.machine.serial_number} ${r.machine.client?.nome ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <div>
      {ToastComponent}

      {/* Page heading */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Devoluções</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {emRevisaoCount > 0 ? `${emRevisaoCount} em revisão` : 'Nenhuma em revisão'}
          </p>
        </div>
      </div>

      {/* Loading bar */}
      {loading && <LoadingBar />}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar as devoluções.</p>
          <Button variant="ghost" onClick={fetchReturns}>Tentar novamente</Button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          <ReturnSummaryCards returns={returns} />

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
              {Object.entries(RETURN_DESTINATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Filter toggle */}
          <div className="flex justify-end gap-2 mb-3">
            <Button
              variant={!showAll ? 'primary' : 'ghost'}
              onClick={() => setShowAll(false)}
            >
              Apenas em revisão
            </Button>
            <Button
              variant={showAll ? 'primary' : 'ghost'}
              onClick={() => setShowAll(true)}
            >
              Ver histórico completo
            </Button>
          </div>

          <ReturnReviewList
            returns={filteredReturns}
            onCompleteReview={handleCompleteReview}
            completingIds={completingIds}
            showAll={showAll}
          />
        </>
      )}
    </div>
  )
}
