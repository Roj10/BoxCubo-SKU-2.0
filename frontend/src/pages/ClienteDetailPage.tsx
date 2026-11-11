import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Pencil, Package, KeyRound, ShoppingCart, RotateCcw, Truck, Layers,
} from 'lucide-react'
import type { ClientOverview } from '../types/client'
import { PRODUCT_LABELS } from '../types/machine'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import StatusBadge from '../components/ui/StatusBadge'
import TypeBadge from '../components/ui/TypeBadge'
import EmptyState from '../components/ui/EmptyState'

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
      <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <Icon size={13} className={accent} /> {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
    </div>
  )
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ClientOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/clients/${id}/overview`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  return (
    <div>
      <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-brand-orange transition-colors mb-4">
        <ArrowLeft size={15} /> Voltar para Clientes
      </Link>

      {loading && <LoadingBar />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar o cliente.</p>
          <Button variant="ghost" onClick={fetchOverview}>Tentar novamente</Button>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{data.client.nome}</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {data.client.cnpj ? `CNPJ ${data.client.cnpj}` : 'CNPJ não informado'}
                {data.client.endereco ? ` · ${data.client.endereco}` : ''}
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Cliente desde {new Date(data.client.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button variant="ghost" onClick={() => navigate(`/clientes/${data.client.id}/editar`)}>
              <Pencil size={15} /> Editar
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Máquinas" value={data.summary.totalMachines} icon={Package} accent="text-neutral-400" />
            <KpiCard label="Alugadas" value={data.summary.alugadas} icon={KeyRound} accent="text-blue-500" />
            <KpiCard label="Vendidas" value={data.summary.vendidas} icon={ShoppingCart} accent="text-brand-500" />
            <KpiCard label="Devoluções" value={data.summary.totalReturns} icon={RotateCcw} accent="text-amber-500" />
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center gap-2">
              <Layers size={16} className="text-brand-orange" />
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Máquinas deste cliente</h2>
            </div>
            {data.machines.length === 0 ? (
              <div className="py-8">
                <EmptyState icon={Package} heading="Nenhuma máquina vinculada" body="Este cliente ainda não tem máquinas." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-700/40 text-xs text-neutral-500 dark:text-neutral-400">
                      <th className="text-left px-4 py-2 font-medium">N° Série</th>
                      <th className="text-left px-4 py-2 font-medium">Produto</th>
                      <th className="text-left px-4 py-2 font-medium">Tipo</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-right px-4 py-2 font-medium">Devoluções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.machines.map((m) => (
                      <tr key={m.id} className="border-t border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link to={`/maquinas/${m.id}`} className="font-mono font-medium text-brand-orange hover:underline">
                            {m.serial_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{PRODUCT_LABELS[m.product_type]}</td>
                        <td className="px-4 py-2.5"><TypeBadge type={m.type} /></td>
                        <td className="px-4 py-2.5"><StatusBadge status={m.status} /></td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {m.returns_count >= 2 ? (
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400">{m.returns_count}</span>
                          ) : (
                            <span className="text-neutral-500 dark:text-neutral-400">{m.returns_count}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center gap-2">
              <Truck size={16} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                Histórico recente <span className="font-normal text-neutral-400 dark:text-neutral-500">({data.summary.totalDeliveries} entregas · {data.summary.totalReturns} devoluções)</span>
              </h2>
            </div>
            {data.events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">Nenhuma movimentação registrada para este cliente.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {data.events.map((e, i) => (
                  <li key={i} className="px-4 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      e.kind === 'DELIVERY'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                    }`}>
                      {e.kind === 'DELIVERY' ? <Truck size={14} /> : <RotateCcw size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        <Link to={`/maquinas/${e.machine_id}`} className="font-mono font-medium text-brand-orange hover:underline">{e.serial_number}</Link>
                        {' — '}{e.description}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{new Date(e.date).toLocaleString('pt-BR')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
