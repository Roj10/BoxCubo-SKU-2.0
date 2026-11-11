import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, Search, Loader2, X, Download, Upload } from 'lucide-react'
import type { Machine, ProductTab, MachineStatus } from '../../types/machine'
import ProductTabs from './ProductTabs'
import MachineTable from './MachineTable'
import Button from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import DeliveryModal from '../deliveries/DeliveryModal'
import ReturnModal from '../returns/ReturnModal'
import MachineHistoryModal from './MachineHistoryModal'

interface MachinesViewProps {
  // 'estoque' = máquinas disponíveis (tipo ESTOQUE); 'cliente' = vendidas/alugadas (no cliente)
  scope: 'estoque' | 'cliente'
}

export default function MachinesView({ scope }: MachinesViewProps) {
  const isStock = scope === 'estoque'
  const basePath = isStock ? '/estoque' : '/vendas'

  const [activeTab, setActiveTab] = useState<ProductTab>('TODOS')
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [deliveryMachine, setDeliveryMachine] = useState<Machine | null>(null)
  const [historyMachine, setHistoryMachine] = useState<Machine | null>(null)
  const [returnMachine, setReturnMachine] = useState<Machine | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VENDA' | 'ALUGUEL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | MachineStatus>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast, ToastComponent } = useToast()

  useEffect(() => {
    if (location.state?.success) {
      const msg = location.state?.isEdit
        ? 'Alterações salvas.'
        : 'Máquina cadastrada.'
      showToast(msg, 'success')
      navigate(basePath, { replace: true, state: null })
    }
  }, [])

  const fetchMachines = () => {
    setLoading(true)
    setError(false)
    setSelectedIds(new Set())
    fetch(activeTab === 'TODOS' ? '/api/machines' : `/api/machines?product_type=${activeTab}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setMachines(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchMachines()
  }, [activeTab])

  // Reset da seleção quando filtros/busca mudam (linhas visíveis podem sair da lista)
  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, typeFilter, statusFilter])

  const handleStartProduction = async (machine: Machine) => {
    try {
      const response = await fetch(`/api/production/start/${machine.id}`, { method: 'POST' })
      if (!response.ok) throw new Error()
      showToast('Produção iniciada.', 'success')
      fetchMachines()
    } catch {
      showToast('Não foi possível iniciar a produção.', 'error')
    }
  }

  const handleRegisterDelivery = (machine: Machine) => setDeliveryMachine(machine)
  const handleViewHistory = (machine: Machine) => setHistoryMachine(machine)
  const handleRegisterReturn = (machine: Machine) => setReturnMachine(machine)

  const handleDelete = async (machine: Machine) => {
    const label = machine.serial_number || '(sem série)'
    const ok = window.confirm(`Excluir a máquina ${label}?\n\nEla sai do estoque e leva junto o histórico de produção, entregas e devoluções.`)
    if (!ok) return
    try {
      const response = await fetch(`/api/machines/${machine.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      showToast(`Máquina ${label} excluída.`, 'success')
      fetchMachines()
    } catch {
      showToast('Não foi possível excluir a máquina.', 'error')
    }
  }

  // Filtro base por escopo: estoque (tipo ESTOQUE e sem cliente — estoque não tem cliente)
  // vs cliente (VENDA/ALUGUEL ou qualquer máquina já vinculada a um cliente)
  const scopeMachines = machines.filter((m) =>
    isStock
      ? m.type === 'ESTOQUE' && !m.client
      : m.type === 'VENDA' || m.type === 'ALUGUEL' || !!m.client
  )

  const filteredMachines = scopeMachines.filter((m) => {
    if (!isStock && typeFilter !== 'ALL' && m.type !== typeFilter) return false
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${m.serial_number} ${m.client?.nome ?? ''} ${m.mac_address ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      const allSelected = filteredMachines.length > 0 && filteredMachines.every((m) => prev.has(m.id))
      if (allSelected) return new Set()
      return new Set(filteredMachines.map((m) => m.id))
    })
  }

  const handleBulkStart = async () => {
    if (bulkRunning) return
    const selected = filteredMachines.filter((m) => selectedIds.has(m.id))
    const targets = selected.filter((m) => m.status === 'AGUARDANDO_PRODUCAO')
    const ignored = selected.length - targets.length

    if (targets.length === 0) {
      showToast('Nenhuma máquina selecionada está aguardando produção.', 'error')
      return
    }

    setBulkRunning(true)
    let started = 0
    for (const m of targets) {
      try {
        const response = await fetch(`/api/production/start/${m.id}`, { method: 'POST' })
        if (!response.ok) throw new Error()
        started += 1
      } catch {
        // falha individual conta como ignorada/não iniciada
      }
    }
    const failed = targets.length - started
    const totalIgnored = ignored + failed
    const summary = `${started} iniciada(s)` + (totalIgnored > 0 ? `, ${totalIgnored} ignorada(s) (não aguardando produção)` : '')
    showToast(summary, started > 0 ? 'success' : 'error')
    setSelectedIds(new Set())
    setBulkRunning(false)
    fetchMachines()
  }

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  const emptyScopeMsg = isStock
    ? 'Nenhuma máquina em estoque neste produto.'
    : 'Nenhuma máquina vendida ou alugada neste produto.'

  return (
    <div>
      {ToastComponent}
      {deliveryMachine && (
        <DeliveryModal
          machine={deliveryMachine}
          onClose={() => setDeliveryMachine(null)}
          onSuccess={() => {
            showToast('Envio registrado.', 'success')
            setDeliveryMachine(null)
            fetchMachines()
          }}
        />
      )}
      {historyMachine && (
        <MachineHistoryModal machine={historyMachine} onClose={() => setHistoryMachine(null)} />
      )}
      {returnMachine && (
        <ReturnModal
          machine={returnMachine}
          onClose={() => setReturnMachine(null)}
          onSuccess={() => {
            showToast('Devolução registrada.', 'success')
            setReturnMachine(null)
            fetchMachines()
          }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {isStock ? 'Estoque' : 'Vendas / Aluguéis'}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {isStock ? 'Máquinas disponíveis na empresa' : 'Máquinas no cliente (vendidas ou alugadas)'}
          </p>
        </div>
        <div className="flex gap-2">
          {isStock && (
            <Link to="/estoque/importar">
              <Button variant="ghost"><Upload size={15} /> Importar CSV</Button>
            </Link>
          )}
          {/* Exporta o produto inteiro da aba ativa — não aplica filtros de type/status/busca */}
          <a href={activeTab === 'TODOS' ? '/api/machines/export.csv' : `/api/machines/export.csv?product_type=${activeTab}`} download>
            <Button variant="ghost"><Download size={15} /> Exportar CSV</Button>
          </a>
        </div>
      </div>

      <ProductTabs
        activeTab={activeTab}
        onChange={(tab) => { if (tab !== activeTab) { setActiveTab(tab); setMachines([]) } }}
      />

      {/* Busca + filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por N° série, cliente ou MAC..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        {!isStock && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectClass}>
            <option value="ALL">Vendidas e alugadas</option>
            <option value="VENDA">Só vendidas</option>
            <option value="ALUGUEL">Só alugadas</option>
          </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectClass}>
          <option value="ALL">Todos os status</option>
          <option value="AGUARDANDO_PRODUCAO">Aguardando produção</option>
          <option value="EM_PRODUCAO">Em produção</option>
          <option value="PRONTO_ENVIO">Pronto p/ envio</option>
          <option value="ENTREGUE">Entregue</option>
          <option value="EM_REVISAO">Em revisão</option>
        </select>
      </div>

      {loading && <div className="h-1 bg-brand-orange animate-pulse w-full mt-2 rounded" />}
      {error && !loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar as máquinas.</p>
          <Button variant="ghost" onClick={fetchMachines}>Tentar novamente</Button>
        </div>
      ) : !loading && scopeMachines.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">{emptyScopeMsg}</p>
      ) : !loading && filteredMachines.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">Nenhuma máquina corresponde aos filtros.</p>
      ) : (
        <MachineTable
          machines={filteredMachines}
          productType={activeTab}
          onEdit={(m) => navigate(`/estoque/${m.id}/editar`)}
          onRowClick={(m) => navigate(`/maquinas/${m.id}`)}
          onDelete={handleDelete}
          onStartProduction={handleStartProduction}
          onRegisterDelivery={handleRegisterDelivery}
          onViewHistory={handleViewHistory}
          onRegisterReturn={isStock ? undefined : handleRegisterReturn}
          selectedIds={selectedIds}
          onToggleRow={handleToggleRow}
          onToggleAll={handleToggleAll}
        />
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg px-4 py-3">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {selectedIds.size} selecionada(s)
          </span>
          <Button variant="primary" onClick={handleBulkStart} disabled={bulkRunning}>
            {bulkRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Iniciando...
              </>
            ) : (
              'Iniciar Produção'
            )}
          </Button>
          <Button variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={bulkRunning}>
            <X size={16} />
            Limpar seleção
          </Button>
        </div>
      )}
    </div>
  )
}
