import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Wrench, Download } from 'lucide-react'
import { STAGES, STAGE_LABELS } from '../types/production'
import type { MachineWithStage, Stage } from '../types/production'
import { PRODUCT_LABELS } from '../types/machine'
import type { ProductType } from '../types/machine'
import KanbanBoard from '../components/production/KanbanBoard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

export default function ProducaoPage() {
  const [machines, setMachines] = useState<MachineWithStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [productFilter, setProductFilter] = useState<'ALL' | ProductType>('ALL')
  const [stageFilter, setStageFilter] = useState<'ALL' | Stage>('ALL')
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const { showToast, ToastComponent } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.state?.success) {
      showToast(location.state?.message || 'Operação concluída.', 'success')
      navigate('/producao', { replace: true, state: null })
    }
  }, [])

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  // Monta a URL de export anexando ?from=&to= apenas com valores preenchidos (vazio = exporta tudo)
  const buildExportUrl = () => {
    const params = new URLSearchParams()
    if (exportFrom) params.set('from', exportFrom)
    if (exportTo) params.set('to', exportTo)
    const qs = params.toString()
    return qs ? `/api/production/export.csv?${qs}` : '/api/production/export.csv'
  }

  const fetchBoard = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/production')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMachines(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBoard()
  }, [])

  // Gate do Flash: máquina sem N° de série precisa associar um antes de entrar no Flash
  const askAndAssignSerial = async (machine: MachineWithStage): Promise<boolean> => {
    let suggestion = ''
    try {
      const r = await fetch(`/api/machines/next-serial?product_type=${machine.product_type}`)
      if (r.ok) suggestion = (await r.json()).serial || ''
    } catch { /* segue sem sugestão */ }
    const input = window.prompt(
      `A máquina precisa de um N° de série para entrar no Flash.\n\nInforme o N° de série:`,
      suggestion,
    )
    if (input === null) return false
    const res = await fetch(`/api/machines/${machine.id}/serial`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial_number: input }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showToast(body.error || 'Não foi possível associar o N° de série.', 'error')
      return false
    }
    return true
  }

  // Gate do Flash: BoxCubo V2 sem MAC address precisa informar um antes de entrar no Flash
  const askAndAssignMac = async (machine: MachineWithStage): Promise<boolean> => {
    const input = window.prompt(
      `A máquina precisa do MAC address para entrar no Flash.\n\nInforme o MAC address:`,
      '',
    )
    if (input === null) return false
    const res = await fetch(`/api/machines/${machine.id}/mac`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac_address: input }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showToast(body.error || 'Não foi possível associar o MAC address.', 'error')
      return false
    }
    return true
  }

  const handleAdvance = async (machineId: string) => {
    try {
      const machine = machines.find((m) => m.id === machineId)
      const openStage = machine?.production_stages.find((s) => !s.completed_at)?.stage
      if (machine && !machine.serial_number && openStage === 'MONTAGEM') {
        const assigned = await askAndAssignSerial(machine)
        if (!assigned) return
      }
      if (machine && machine.product_type === 'BOXCUBO_V2' && !machine.mac_address && openStage === 'MONTAGEM') {
        const assigned = await askAndAssignMac(machine)
        if (!assigned) return
      }
      const res = await fetch(`/api/production/advance/${machineId}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.error === 'SERIAL_REQUIRED') {
          showToast(body.message || 'Associe um N° de série antes do Flash.', 'error')
          return
        }
        if (body.error === 'MAC_REQUIRED') {
          showToast(body.message || 'Informe o MAC address antes do Flash.', 'error')
          return
        }
        throw new Error()
      }
      const data = await res.json()
      const isCompleted = data.status === 'PRONTO_ENVIO'
      showToast(
        isCompleted ? 'Máquina concluída. Status: Pronta para envio.' : 'Etapa avançada.',
        'success',
      )
      await fetchBoard()
    } catch {
      showToast('Não foi possível avançar a etapa.', 'error')
    }
  }

  const handleRollback = async (machineId: string) => {
    try {
      const res = await fetch(`/api/production/rollback/${machineId}`, { method: 'POST' })
      if (!res.ok) throw new Error()
      showToast('Etapa recuada.', 'success')
      await fetchBoard()
    } catch {
      showToast('Não foi possível recuar a etapa.', 'error')
    }
  }

  const handleCancel = async (machineId: string) => {
    try {
      const res = await fetch(`/api/production/cancel/${machineId}`, { method: 'POST' })
      if (!res.ok) throw new Error()
      showToast('Produção cancelada. Máquina devolvida ao estoque.', 'success')
      await fetchBoard()
    } catch {
      showToast('Não foi possível cancelar a produção.', 'error')
    }
  }

  // Arrastar e soltar: encadeia avançar/voltar conforme a coluna de destino
  const handleMove = async (machineId: string, fromStage: Stage, toStage: Stage) => {
    const from = STAGES.indexOf(fromStage)
    const to = STAGES.indexOf(toStage)
    if (from === -1 || to === -1 || from === to) return
    const direction = to > from ? 'advance' : 'rollback'
    const steps = Math.abs(to - from)
    try {
      for (let i = 0; i < steps; i++) {
        const res = await fetch(`/api/production/${direction}/${machineId}`, { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          // Gates do Flash (série/MAC) têm mensagem própria do backend
          throw new Error(body.message || '')
        }
      }
      showToast(direction === 'advance' ? 'Máquina avançada de etapa.' : 'Máquina recuada de etapa.', 'success')
      await fetchBoard()
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : 'Não foi possível mover a máquina.'
      showToast(message, 'error')
      await fetchBoard()
    }
  }

  const filteredMachines = machines.filter((m) => {
    if (productFilter !== 'ALL' && m.product_type !== productFilter) return false
    if (stageFilter !== 'ALL' && m.production_stages[0]?.stage !== stageFilter) return false
    return true
  })

  const subHeading =
    machines.length === 0
      ? 'Nenhuma máquina em produção'
      : machines.length === 1
      ? '1 máquina em produção'
      : `${machines.length} máquinas em produção`

  return (
    <div>
      {ToastComponent}

      {/* Page heading */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Produção</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{subHeading}</p>
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
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar o painel de produção.</p>
          <button
            onClick={fetchBoard}
            className="border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state — 0 machines total */}
      {!loading && !error && machines.length === 0 && (
        <EmptyState
          icon={Wrench}
          heading="Nenhuma máquina em produção"
          body="Inicie a produção de uma máquina na tela de Estoque."
        />
      )}

      {/* Board */}
      {!loading && !error && machines.length > 0 && (
        <>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value as typeof productFilter)} className={selectClass}>
              <option value="ALL">Todos os produtos</option>
              {Object.entries(PRODUCT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)} className={selectClass}>
              <option value="ALL">Todas as etapas</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {filteredMachines.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">Nenhuma máquina corresponde aos filtros.</p>
          ) : (
            <KanbanBoard
              machines={filteredMachines}
              onAdvance={handleAdvance}
              onRollback={handleRollback}
              onCancel={handleCancel}
              onMove={handleMove}
            />
          )}
        </>
      )}
    </div>
  )
}
