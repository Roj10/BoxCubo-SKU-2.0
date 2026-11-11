import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Factory, Send, Truck, RotateCcw, CalendarClock, X, Wrench, PackageCheck } from 'lucide-react'
import type { DashboardData, OperationMachine } from '../types/dashboard'
import type { AlertsResponse, AlertSeverity } from '../types/alert'
import type { InsightsData } from '../types/system'
import type { MachineWithStage } from '../types/production'
import { PRODUCT_LABELS } from '../types/machine'

const STAGE_LABELS: Record<string, string> = {
  RECEBIMENTO: 'Análise',
  MONTAGEM: 'Montagem',
  FLASH_FIRMWARE: 'Flash',
  TESTE: 'Teste',
  EMBALAGEM: 'Embalagem',
}
const STAGES = ['RECEBIMENTO', 'MONTAGEM', 'FLASH_FIRMWARE', 'TESTE', 'EMBALAGEM']

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-400',
  baixa: 'bg-blue-400',
}

// "BC00001 | Cliente" — omite o lado que faltar
function machineLabel(serial: string | null, client: string | null | undefined): string {
  if (serial && client) return `${serial} | ${client}`
  return serial || client || 'Sem série'
}

// Urgência do prazo no fundo escuro da TV (datas são meia-noite UTC → compara só a data)
function deadlineTvInfo(deadline: string): { label: string; cls: string } {
  const d = deadline.slice(0, 10)
  const [, m, day] = d.split('-').map(Number)
  const label = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const diff = Math.round((Date.parse(d) - Date.parse(todayStr)) / 86_400_000)
  if (diff < 0) return { label: `${label} · atrasado`, cls: 'text-red-400 font-semibold' }
  if (diff === 0) return { label: `${label} · hoje`, cls: 'text-amber-400 font-semibold' }
  if (diff <= 3) return { label: `${label} · ${diff}d`, cls: 'text-amber-400' }
  return { label, cls: 'text-neutral-500' }
}

function BigKpi({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex items-center gap-5">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={28} />
      </div>
      <div>
        <p className="text-5xl font-bold text-white leading-none tabular-nums">{value}</p>
        <p className="text-sm text-neutral-400 mt-2 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

export default function TvPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [inProduction, setInProduction] = useState<MachineWithStage[]>([])
  const [now, setNow] = useState(new Date())

  const fetchAll = useCallback(async () => {
    try {
      const [d, a, i, p] = await Promise.all([
        fetch('/api/dashboard').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/alerts').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/dashboard/insights').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/production').then((r) => (r.ok ? r.json() : null)),
      ])
      if (d) setData(d)
      if (a) setAlerts(a)
      if (i) setInsights(i)
      if (p) setInProduction(p)
    } catch {
      // modo TV tolera falhas pontuais: mantém os últimos dados na tela
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const dataId = setInterval(fetchAll, 15_000)
    const clockId = setInterval(() => setNow(new Date()), 1_000)
    return () => {
      clearInterval(dataId)
      clearInterval(clockId)
    }
  }, [fetchAll])

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 lg:p-10">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-brand-orange animate-pulse" />
          <h1 className="text-2xl font-bold tracking-tight">
            BOX CUBO <span className="text-neutral-500 font-normal">· Central de Operação</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums leading-none">
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-neutral-500 mt-1 capitalize">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <Link to="/dashboard" aria-label="Sair do modo TV" className="text-neutral-600 hover:text-white transition-colors">
            <X size={28} />
          </Link>
        </div>
      </div>

      {!data ? (
        <div className="flex items-center justify-center min-h-[60vh] text-neutral-500 text-lg">Carregando…</div>
      ) : (
        <div className="space-y-6">
          {/* KPIs gigantes */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <BigKpi label="Em produção" value={data.kpis.emProducao} icon={Factory} accent="bg-blue-500/15 text-blue-400" />
            <BigKpi label="Pronto p/ envio" value={data.kpis.prontoEnvio} icon={Send} accent="bg-amber-500/15 text-amber-400" />
            <BigKpi label="Entregues" value={data.deliveries.entregue} icon={Truck} accent="bg-green-500/15 text-green-400" />
            <BigKpi label="Em revisão" value={data.kpis.emRevisao} icon={RotateCcw} accent="bg-red-500/15 text-red-400" />
          </div>

          {/* Linha de produção — contagem + máquinas de cada etapa */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <p className="text-sm text-neutral-400 uppercase tracking-wide mb-4">Linha de produção agora</p>
            <div className="grid grid-cols-5 gap-3 items-start">
              {STAGES.map((s) => {
                const machines = inProduction.filter((m) => m.production_stages.find((st) => !st.completed_at)?.stage === s)
                const count = data.productionByStage[s] ?? machines.length
                return (
                  <div key={s} className="text-center min-w-0">
                    <p className={`text-4xl font-bold tabular-nums ${count > 0 ? 'text-white' : 'text-neutral-700'}`}>{count}</p>
                    <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">{STAGE_LABELS[s]}</p>
                    <div className="mt-3 space-y-1.5">
                      {machines.slice(0, 4).map((m) => (
                        <p key={m.id} className="text-[13px] leading-snug bg-neutral-800/80 rounded px-2 py-1 truncate" title={machineLabel(m.serial_number, m.client?.nome)}>
                          <span className="font-mono font-semibold text-brand-300">{m.serial_number || 'Sem série'}</span>
                          {m.client?.nome && <span className="text-neutral-400"> | {m.client.nome}</span>}
                        </p>
                      ))}
                      {machines.length > 4 && <p className="text-xs text-neutral-600">+ {machines.length - 4}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Prazos mais urgentes */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock size={18} className="text-brand-orange" />
                <p className="text-sm text-neutral-400 uppercase tracking-wide">Prazos de entrega</p>
              </div>
              {(() => {
                const om = data.operationMachines
                const withDeadline: OperationMachine[] = om
                  ? [...om.aguardandoProducao, ...om.emProducao, ...om.prontoEnvio, ...om.emRevisao].filter((m) => m.deadline)
                  : []
                withDeadline.sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
                if (withDeadline.length === 0) {
                  return <p className="text-neutral-600 text-lg py-6 text-center">Nenhum prazo definido</p>
                }
                return (
                  <ul className="space-y-2.5">
                    {withDeadline.slice(0, 7).map((m) => {
                      const info = deadlineTvInfo(m.deadline!)
                      return (
                        <li key={m.id} className="flex items-baseline gap-2 min-w-0">
                          <span className="font-mono font-semibold text-[15px] text-neutral-100 shrink-0">{m.serial_number || 'Sem série'}</span>
                          <span className="text-sm text-neutral-500 truncate">{m.client ? `| ${m.client}` : ''}</span>
                          <span className={`ml-auto shrink-0 text-sm tabular-nums ${info.cls}`}>{info.label}</span>
                        </li>
                      )
                    })}
                    {withDeadline.length > 7 && <li className="text-sm text-neutral-600">+ {withDeadline.length - 7} outros</li>}
                  </ul>
                )
              })()}
            </div>

            {/* Pronto para envio */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <PackageCheck size={18} className="text-green-400" />
                <p className="text-sm text-neutral-400 uppercase tracking-wide">Pronto para envio</p>
              </div>
              {!data.operationMachines || data.operationMachines.prontoEnvio.length === 0 ? (
                <p className="text-neutral-600 text-lg py-6 text-center">Nada aguardando envio</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.operationMachines.prontoEnvio.slice(0, 7).map((m) => (
                    <li key={m.id} className="flex items-baseline gap-2 min-w-0">
                      <span className="font-mono font-semibold text-[15px] text-neutral-100 shrink-0">{m.serial_number || 'Sem série'}</span>
                      <span className="text-sm text-neutral-500 truncate">{m.client ? `| ${m.client}` : ''}</span>
                    </li>
                  ))}
                  {data.operationMachines.prontoEnvio.length > 7 && (
                    <li className="text-sm text-neutral-600">+ {data.operationMachines.prontoEnvio.length - 7} outras</li>
                  )}
                </ul>
              )}
            </div>

            {/* Alertas */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-400" />
                <p className="text-sm text-neutral-400 uppercase tracking-wide">
                  Alertas {alerts && alerts.count > 0 && <span className="text-amber-400 font-bold">({alerts.count})</span>}
                </p>
              </div>
              {!alerts || alerts.alerts.length === 0 ? (
                <p className="text-neutral-600 text-lg py-6 text-center">Nenhum alerta ativo</p>
              ) : (
                <ul className="space-y-3">
                  {alerts.alerts.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[a.severity]}`} />
                      <div>
                        <p className="text-base text-neutral-200 leading-snug">{a.title}</p>
                        <p className="text-sm text-neutral-500">{a.detail}</p>
                      </div>
                    </li>
                  ))}
                  {alerts.alerts.length > 6 && (
                    <li className="text-sm text-neutral-500">+ {alerts.alerts.length - 6} outros alertas</li>
                  )}
                </ul>
              )}
            </div>

          </div>

          {/* Capacidade de produção */}
          {insights && insights.capacity.some((c) => c.capacity !== null) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Wrench size={18} className="text-green-400" />
                <p className="text-sm text-neutral-400 uppercase tracking-wide">Capacidade de produção com materiais atuais</p>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {insights.capacity.map((c) => (
                  <div key={c.product} className="text-center">
                    <p className={`text-4xl font-bold tabular-nums ${
                      c.capacity === null ? 'text-neutral-700' : c.capacity === 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {c.capacity === null ? '—' : c.capacity}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">{PRODUCT_LABELS[c.product]}</p>
                    {c.capacity !== null && c.bottleneck && (
                      <p className="text-xs text-neutral-600 mt-0.5 truncate">gargalo: {c.bottleneck}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-neutral-700">Atualização automática a cada 15 segundos</p>
        </div>
      )}
    </div>
  )
}
