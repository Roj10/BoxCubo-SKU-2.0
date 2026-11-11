import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Printer, Factory, Truck, RotateCcw, PackagePlus } from 'lucide-react'
import type { PeriodReport } from '../types/system'
import { PRODUCT_LABELS } from '../types/machine'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'

function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function SummaryCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60">
      <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <Icon size={13} className={accent} /> {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          {title} <span className="font-normal text-neutral-400 dark:text-neutral-500">({count})</span>
        </h2>
      </div>
      {count === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">Nenhum registro no período.</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  )
}

const thClass = 'text-left px-4 py-2 font-medium'
const tdClass = 'px-4 py-2.5 text-neutral-700 dark:text-neutral-300'
const trClass = 'border-t border-neutral-100 dark:border-neutral-700'
const theadClass = 'bg-neutral-50 dark:bg-neutral-700/40 text-xs text-neutral-500 dark:text-neutral-400'

export default function RelatorioPage() {
  const [from, setFrom] = useState(() => toInputDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
  const [to, setTo] = useState(() => toInputDate(new Date()))
  const [report, setReport] = useState<PeriodReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/dashboard/report?from=${from}&to=${to}`)
      if (!res.ok) throw new Error()
      setReport(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR')
  const periodLabel = report ? `${fmtDate(report.from)} a ${fmtDate(report.to)}` : ''

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Relatório do Período</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Fechamento de {periodLabel || '...'}</p>
        </div>
        <div className="flex items-end gap-2 no-print">
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} />
          </div>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer size={15} /> Imprimir
          </Button>
        </div>
      </div>

      {loading && <LoadingBar />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar o relatório.</p>
          <Button variant="ghost" onClick={fetchReport}>Tentar novamente</Button>
        </div>
      )}

      {report && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Produzidas no período" value={report.totals.produced} icon={Factory} accent="text-blue-500" />
            <SummaryCard label="Entregues no período" value={report.totals.delivered} icon={Truck} accent="text-emerald-600" />
            <SummaryCard label="Devoluções no período" value={report.totals.returns} icon={RotateCcw} accent="text-amber-500" />
            <SummaryCard label="Máquinas cadastradas" value={report.totals.newMachines} icon={PackagePlus} accent="text-brand-500" />
          </div>

          <Section title="Produção concluída" count={report.produced.length}>
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>N° Série</th>
                  <th className={thClass}>Produto</th>
                  <th className={thClass}>Concluída em</th>
                </tr>
              </thead>
              <tbody>
                {report.produced.map((r, i) => (
                  <tr key={i} className={trClass}>
                    <td className={tdClass}>
                      <Link to={`/maquinas/${r.machine_id}`} className="font-mono font-medium text-brand-orange hover:underline">{r.serial_number}</Link>
                    </td>
                    <td className={tdClass}>{PRODUCT_LABELS[r.product_type]}</td>
                    <td className={tdClass}>{new Date(r.date).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Entregas concluídas" count={report.delivered.length}>
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>N° Série</th>
                  <th className={thClass}>Produto</th>
                  <th className={thClass}>Cliente</th>
                  <th className={thClass}>Transportadora</th>
                  <th className={thClass}>Entregue em</th>
                </tr>
              </thead>
              <tbody>
                {report.delivered.map((r, i) => (
                  <tr key={i} className={trClass}>
                    <td className={tdClass}>
                      <Link to={`/maquinas/${r.machine_id}`} className="font-mono font-medium text-brand-orange hover:underline">{r.serial_number}</Link>
                    </td>
                    <td className={tdClass}>{PRODUCT_LABELS[r.product_type]}</td>
                    <td className={tdClass}>{r.client ?? '—'}</td>
                    <td className={tdClass}>{r.carrier ?? '—'}</td>
                    <td className={tdClass}>{fmtDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Devoluções registradas" count={report.returns.length}>
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>N° Série</th>
                  <th className={thClass}>Produto</th>
                  <th className={thClass}>Motivo</th>
                  <th className={thClass}>Destino</th>
                  <th className={thClass}>Data</th>
                </tr>
              </thead>
              <tbody>
                {report.returns.map((r, i) => (
                  <tr key={i} className={trClass}>
                    <td className={tdClass}>
                      <Link to={`/maquinas/${r.machine_id}`} className="font-mono font-medium text-brand-orange hover:underline">{r.serial_number}</Link>
                    </td>
                    <td className={tdClass}>{PRODUCT_LABELS[r.product_type]}</td>
                    <td className={tdClass}>{r.reason}</td>
                    <td className={tdClass}>{r.destination}</td>
                    <td className={tdClass}>{fmtDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Máquinas cadastradas" count={report.newMachines.length}>
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>N° Série</th>
                  <th className={thClass}>Produto</th>
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Cadastrada por</th>
                  <th className={thClass}>Data</th>
                </tr>
              </thead>
              <tbody>
                {report.newMachines.map((r, i) => (
                  <tr key={i} className={trClass}>
                    <td className={tdClass}>
                      <Link to={`/maquinas/${r.machine_id}`} className="font-mono font-medium text-brand-orange hover:underline">{r.serial_number}</Link>
                    </td>
                    <td className={tdClass}>{PRODUCT_LABELS[r.product_type]}</td>
                    <td className={tdClass}>{r.type}</td>
                    <td className={tdClass}>{r.created_by}</td>
                    <td className={tdClass}>{fmtDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
            {report.totals.started} produção(ões) iniciada(s) no mesmo período · Relatório gerado pelo Controle BoxCubo
          </p>
        </div>
      )}
    </div>
  )
}
