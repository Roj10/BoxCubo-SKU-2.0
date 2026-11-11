import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, Boxes, Factory, Truck, RotateCcw, Clock,
  Package, PackageCheck, Send, Warehouse, ShoppingCart, KeyRound, Printer,
  TrendingUp, ShieldAlert, Wrench, MonitorPlay,
} from 'lucide-react'
import Button from '../components/ui/Button'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { DashboardData, ProductKey, OperationMachine } from '../types/dashboard'
import type { MachineStatus } from '../types/machine'
import { deadlineInfo } from '../lib/deadline'
import type { TrendsData, InsightsData } from '../types/system'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingBar from '../components/ui/LoadingBar'
import { useTheme } from '../hooks/useTheme'

const PRODUCTS: ProductKey[] = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE']
const PRODUCT_LABELS: Record<ProductKey, string> = { BOXCUBO_V2: 'BoxCubo V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE' }
const STAGE_LABELS: Record<string, string> = { RECEBIMENTO: 'Análise', MONTAGEM: 'Montagem', FLASH_FIRMWARE: 'Flash', TESTE: 'Teste', EMBALAGEM: 'Embalagem' }
const STAGES = ['RECEBIMENTO', 'MONTAGEM', 'FLASH_FIRMWARE', 'TESTE', 'EMBALAGEM']

// Paleta dos gráficos derivada da marca: laranja + neutros quentes + acentos comedidos
const COLORS = {
  orange: '#da8301',
  venda: '#da8301',
  aluguel: '#4a7ba6',
  estoque: '#a5a199',
  blue: '#4a7ba6',
  amber: '#e5a246',
  green: '#55876a',
  red: '#c0504d',
}
const DELIVERY_COLORS = [COLORS.amber, COLORS.green]

interface KpiCardProps {
  label: string
  value: number
  icon: React.ElementType
  accent: string // classe de cor do ícone (ex: 'text-emerald-600')
}
function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
      <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <Icon size={13} className={accent} /> {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
    </div>
  )
}

// Card de operação: KPI + lista de máquinas (série — cliente · prazo) do status
function OperationCard({ label, value, icon: Icon, accent, machines, status }: KpiCardProps & { machines: OperationMachine[]; status: MachineStatus }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
      <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <Icon size={13} className={accent} /> {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
      {machines.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700 max-h-36 overflow-y-auto flex flex-col gap-1">
          {machines.map((m) => {
            const info = deadlineInfo(m.deadline, status)
            return (
              <li key={m.id} className="text-xs flex items-baseline gap-1.5 min-w-0">
                <Link to={`/maquinas/${m.id}`} className={`font-mono shrink-0 hover:underline ${m.serial_number ? 'font-semibold text-brand-orange' : 'italic text-neutral-400 dark:text-neutral-500'}`}>
                  {m.serial_number || 'Sem série'}
                </Link>
                <span className="text-neutral-500 dark:text-neutral-400 truncate">{m.client ? `— ${m.client}` : ''}</span>
                {info && (
                  <span className={`ml-auto shrink-0 whitespace-nowrap ${info.cls}`}>
                    {info.label}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ChartCard({ title, icon: Icon, accent, children }: { title: string; icon: React.ElementType; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className={accent} />
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const gridStroke = isDark ? '#3f3f46' : '#f1f5f9'
  const tickFill = isDark ? '#a1a1aa' : '#64748b'
  const cursorFill = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc'
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
    background: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#e5e5e5' : '#111827',
  }
  const [data, setData] = useState<DashboardData | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  const fetchTrends = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/trends')
      if (!res.ok) throw new Error('fetch failed')
      setTrends(await res.json())
    } catch {
      // tendências são complementares: falha não derruba o dashboard
    }
    try {
      const res = await fetch('/api/dashboard/insights')
      if (!res.ok) throw new Error('fetch failed')
      setInsights(await res.json())
    } catch {
      // insights são complementares: falha não derruba o dashboard
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchDashboard().finally(() => setLoading(false))
    fetchTrends()
    const intervalId = setInterval(fetchDashboard, 10_000)
    const trendsIntervalId = setInterval(fetchTrends, 60_000)
    return () => {
      clearInterval(intervalId)
      clearInterval(trendsIntervalId)
    }
  }, [fetchDashboard, fetchTrends])

  const stockData = data
    ? PRODUCTS.map((p) => ({
        produto: PRODUCT_LABELS[p],
        Venda: data.stock[p].VENDA,
        Aluguel: data.stock[p].ALUGUEL,
        Estoque: data.stock[p].ESTOQUE,
      }))
    : []

  const productionData = data
    ? STAGES.map((s) => ({ etapa: STAGE_LABELS[s], qtd: data.productionByStage[s] ?? 0 }))
    : []

  const deliveryData = data
    ? [
        { name: 'Aguardando', value: data.deliveries.aguardandoColeta },
        { name: 'Entregues', value: data.deliveries.entregue },
      ].filter((d) => d.value > 0)
    : []

  const situacaoData = data
    ? [
        { name: 'Em estoque', value: data.kpis.estoque, color: COLORS.estoque },
        { name: 'Vendidas', value: data.kpis.vendidas, color: COLORS.venda },
        { name: 'Alugadas', value: data.kpis.alugadas, color: COLORS.aluguel },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Visão geral em tempo real · atualiza a cada 10s</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Link
            to="/tv"
            className="inline-flex items-center gap-2 border border-neutral-300 text-neutral-700 px-4 py-2 rounded-md text-sm hover:bg-neutral-50 transition-colors dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <MonitorPlay size={15} /> Modo TV
          </Link>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer size={15} /> Exportar PDF
          </Button>
        </div>
      </div>

      {loading && <LoadingBar />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar o dashboard.</p>
          <button onClick={fetchDashboard} className="border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Tentar novamente</button>
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* Capacidade de produção */}
          {insights && insights.capacity.some((c) => c.capacity !== null) && (
            <div>
              <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">Capacidade de produção com os materiais atuais</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {insights.capacity.map((c) => (
                  <div key={c.product} className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      c.capacity === null
                        ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500'
                        : c.capacity === 0
                          ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                          : 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                    }`}>
                      <Wrench size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 leading-none tabular-nums">
                        {c.capacity === null ? '—' : c.capacity}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                        {PRODUCT_LABELS[c.product]}
                        {c.capacity === null
                          ? ' · sem BOM'
                          : c.bottleneck
                            ? ` · gargalo: ${c.bottleneck}`
                            : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de materiais baixos */}
          {data.materials.lowCount > 0 && (
            <Link
              to="/materiais"
              className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              <AlertTriangle size={20} className="text-red-500 dark:text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {data.materials.lowCount} {data.materials.lowCount === 1 ? 'material com estoque baixo' : 'materiais com estoque baixo'} (≤ 20%)
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {data.materials.low.slice(0, 4).map((m) => `${m.name} (${m.percent}%)`).join(' · ')}
                  {data.materials.low.length > 4 && ` +${data.materials.low.length - 4}`}
                </p>
              </div>
              <span className="text-xs font-medium text-red-600 dark:text-red-400 underline">Ver materiais</span>
            </Link>
          )}

          {/* KPIs — Situação comercial */}
          <div>
            <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">Situação comercial</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Total de máquinas" value={data.kpis.totalMachines} icon={Package} accent="text-neutral-400" />
              <KpiCard label="Em estoque" value={data.kpis.estoque} icon={Warehouse} accent="text-emerald-600" />
              <KpiCard label="Vendidas" value={data.kpis.vendidas} icon={ShoppingCart} accent="text-brand-500" />
              <KpiCard label="Alugadas" value={data.kpis.alugadas} icon={KeyRound} accent="text-blue-500" />
            </div>
          </div>

          {/* KPIs — Operação */}
          <div>
            <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">Operação</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-start">
              <OperationCard label="Em produção" value={data.kpis.emProducao} icon={Factory} accent="text-blue-500" machines={data.operationMachines?.emProducao ?? []} status="EM_PRODUCAO" />
              <OperationCard label="Pronto p/ envio" value={data.kpis.prontoEnvio} icon={Send} accent="text-emerald-600" machines={data.operationMachines?.prontoEnvio ?? []} status="PRONTO_ENVIO" />
              <OperationCard label="Entregues" value={data.kpis.entregue} icon={PackageCheck} accent="text-neutral-400" machines={data.operationMachines?.entregue ?? []} status="ENTREGUE" />
              <OperationCard label="Em revisão" value={data.kpis.emRevisao} icon={RotateCcw} accent="text-amber-500" machines={data.operationMachines?.emRevisao ?? []} status="EM_REVISAO" />
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Situação comercial (donut) */}
            <ChartCard title="Situação Comercial" icon={ShoppingCart} accent="text-brand-500">
              {situacaoData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={situacaoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {situacaoData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Situação por produto */}
            <ChartCard title="Situação por Produto" icon={Boxes} accent="text-brand-orange">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stockData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="produto" tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Venda" stackId="a" fill={COLORS.venda} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Aluguel" stackId="a" fill={COLORS.aluguel} />
                  <Bar dataKey="Estoque" stackId="a" fill={COLORS.estoque} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Produção por etapa */}
            <ChartCard title="Produção por Etapa" icon={Factory} accent="text-blue-500">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={productionData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="etapa" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} />
                  <Bar dataKey="qtd" name="Máquinas" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Entregas */}
            <ChartCard title="Entregas" icon={Truck} accent="text-amber-500">
              {deliveryData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">Nenhuma entrega registrada.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={deliveryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {deliveryData.map((_, i) => (
                        <Cell key={i} fill={DELIVERY_COLORS[i % DELIVERY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Tempos médios */}
            <ChartCard title="Tempos Médios por Produto" icon={Clock} accent="text-neutral-400">
              <div className="overflow-x-auto rounded-lg border border-neutral-100 dark:border-neutral-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-700/40 text-xs text-neutral-500 dark:text-neutral-400">
                      <th className="text-left px-3 py-2 font-medium">Produto</th>
                      <th className="text-right px-3 py-2 font-medium">Produção</th>
                      <th className="text-right px-3 py-2 font-medium">Permanência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCTS.map((p) => (
                      <tr key={p} className="border-t border-neutral-100 dark:border-neutral-700">
                        <td className="px-3 py-2.5 text-neutral-700 dark:text-neutral-300">{PRODUCT_LABELS[p]}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-900 dark:text-neutral-100 tabular-nums">{data.avgTimes[p].avgProduction}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-900 dark:text-neutral-100 tabular-nums">{data.avgTimes[p].avgStay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>

          {/* Tendências */}
          {trends && (
            <div>
              <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">Tendências · últimas 8 semanas</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartCard title="Produção × Entregas por Semana" icon={TrendingUp} accent="text-emerald-600">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trends.weeks} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="produced" name="Produzidas" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="delivered" name="Entregues" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Motivos de Devolução (top 6)" icon={RotateCcw} accent="text-amber-500">
                  {trends.returnReasons.length === 0 ? (
                    <div className="h-[240px] flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">Nenhuma devolução registrada.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={trends.returnReasons} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="reason" width={130} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} />
                        <Bar dataKey="count" name="Devoluções" fill={COLORS.red} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* Máquinas reincidentes */}
              {trends.repeatOffenders.length > 0 && (
                <div className="mt-5 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
                  <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-500" />
                    <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                      Máquinas reincidentes <span className="font-normal text-neutral-400 dark:text-neutral-500">(2+ devoluções no histórico)</span>
                    </h2>
                  </div>
                  <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {trends.repeatOffenders.map((m) => (
                      <li key={m.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link to={`/maquinas/${m.id}`} className="font-mono text-sm font-medium text-brand-orange hover:underline">
                          {m.serial_number}
                        </Link>
                        <span className="text-sm text-neutral-600 dark:text-neutral-300">{PRODUCT_LABELS[m.product_type]}</span>
                        {m.client && <span className="text-xs text-neutral-400 dark:text-neutral-500">Cliente: {m.client.nome}</span>}
                        <StatusBadge status={m.status} />
                        <span className="ml-auto text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">
                          {m.returns_count} devoluções
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
