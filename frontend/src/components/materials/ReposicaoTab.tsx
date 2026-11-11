import { useState, useEffect, useCallback } from 'react'
import { Download, PackagePlus, Check } from 'lucide-react'
import type { Replenishment, ProductKey } from '../../types/material'
import Button from '../ui/Button'
import LoadingBar from '../ui/LoadingBar'
import SkuTag from './SkuTag'
import { card, th, theadRow, tr, fmtQty, fmtMoney, PRODUCT_SHORT, lastActor } from './shared'

const PRODUCTS: ProductKey[] = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE']
const LABELS: Record<ProductKey, string> = { BOXCUBO_V2: 'BoxCubo V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE' }

// Reposição: o estoque mínimo é "ter material para N máquinas" de cada produto
// (multiplicado pela receita; subconjuntos abrem nos componentes). A lista
// mostra o que está abaixo e quanto comprar, separado por fornecedor.
export default function ReposicaoTab({ reloadKey, onCount, onEntrada, showToast }: {
  reloadKey: number
  onCount: (n: number) => void
  onEntrada: (items: { material_id: string; quantity: number }[]) => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [data, setData] = useState<Replenishment | null>(null)
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState<Record<ProductKey, string>>({ BOXCUBO_V2: '0', SLIM: '0', VISION: '0', EYE: '0' })

  const apply = useCallback((r: Replenishment) => {
    setData(r)
    onCount(r.lines.length)
    setTargets(Object.fromEntries(PRODUCTS.map((p) => [p, String(r.targets[p] ?? 0)])) as Record<ProductKey, string>)
  }, [onCount])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/replenishment')
      if (res.ok) apply(await res.json())
    } finally {
      setLoading(false)
    }
  }, [apply])

  useEffect(() => { fetchData() }, [fetchData, reloadKey])

  const saveTarget = async (p: ProductKey) => {
    const n = Number(targets[p])
    if (!Number.isInteger(n) || n < 0) return showToast('Informe um número inteiro de máquinas.', 'error')
    if (data && data.targets[p] === n) return
    const res = await fetch('/api/replenishment/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_type: p, min_machines: n, actor: lastActor() || 'Sistema' }),
    })
    if (res.ok) {
      apply(await res.json())
      showToast(`Mínimo da ${LABELS[p]}: material para ${n} máquinas.`, 'success')
    } else {
      showToast('Não foi possível salvar o mínimo.', 'error')
    }
  }

  // agrupa as linhas pelo fornecedor principal
  const groups: { supplier: string; lines: Replenishment['lines'] }[] = []
  for (const l of data?.lines ?? []) {
    const s = l.supplier ?? 'Sem fornecedor'
    const g = groups.find((x) => x.supplier === s)
    if (g) g.lines.push(l)
    else groups.push({ supplier: s, lines: [l] })
  }

  return (
    <div>
      {/* Estoque mínimo por produto */}
      <div className={`${card} px-4 py-3 mb-4`}>
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Estoque mínimo</h3>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
          Ter sempre material para quantas máquinas de cada produto. O mínimo de cada material sai da receita.
        </p>
        <div className="flex flex-wrap gap-4">
          {PRODUCTS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <span className="w-20">{LABELS[p]}</span>
              <input
                type="number"
                min="0"
                value={targets[p]}
                onChange={(e) => setTargets((t) => ({ ...t, [p]: e.target.value }))}
                onBlur={() => saveTarget(p)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="w-20 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100"
              />
              <span className="text-xs text-neutral-400">máquinas</span>
            </label>
          ))}
        </div>
      </div>

      {loading && <LoadingBar />}
      {data && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div className="flex gap-8">
              <Kpi label="Abaixo do mínimo" value={String(data.lines.length)} />
              <Kpi label="Zerados" value={String(data.zeroed)} />
              <Kpi label="Custo para repor" value={fmtMoney(data.total_cost)} note={data.without_price ? `${data.without_price} sem preço: valor parcial` : undefined} />
            </div>
            {data.lines.length > 0 && (
              <div className="flex gap-2">
                <a href="/api/replenishment/export.csv" download>
                  <Button variant="ghost"><Download size={15} /> Exportar CSV</Button>
                </a>
                <Button variant="primary" onClick={() => onEntrada(data.lines.map((l) => ({ material_id: l.material_id, quantity: l.buy })))}>
                  <PackagePlus size={15} /> Dar entrada desta lista
                </Button>
              </div>
            )}
          </div>

          {data.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-2 text-center">
              <Check size={36} className="text-emerald-500" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {PRODUCTS.every((p) => !data.targets[p]) ? 'Defina o estoque mínimo acima para ver o que repor.' : 'Todos os materiais estão acima do mínimo.'}
              </p>
            </div>
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className={th}>Material</th>
                    <th className={th}>Código no fornecedor</th>
                    <th className={`${th} text-right`}>Estoque</th>
                    <th className={`${th} text-right`}>Mínimo</th>
                    <th className={`${th} text-right`}>Comprar</th>
                    <th className={`${th} text-right`}>Preço unit.</th>
                    <th className={`${th} text-right`}>Custo</th>
                    <th className={th}>Usado em</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <GroupRows key={g.supplier} supplier={g.supplier} lines={g.lines} />
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

function GroupRows({ supplier, lines }: { supplier: string; lines: Replenishment['lines'] }) {
  const subtotal = lines.reduce((s, l) => s + (l.cost ?? 0), 0)
  return (
    <>
      <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-700">
        <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {supplier} <span className="font-normal text-neutral-400">({lines.length})</span>
        </td>
        <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{fmtMoney(subtotal)}</td>
        <td></td>
      </tr>
      {lines.map((l) => (
        <tr key={l.material_id} className={tr}>
          <td className="px-4 py-2.5 text-neutral-800 dark:text-neutral-200">
            <div className="flex items-center gap-2"><SkuTag sku={l.sku} /><span>{l.name}</span></div>
          </td>
          <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">{l.supplier_code ?? '—'}</td>
          <td className={`px-4 py-2.5 text-right tabular-nums ${l.current <= 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-neutral-600 dark:text-neutral-300'}`}>
            {fmtQty(l.current)} {l.unit}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{fmtQty(l.minimum)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-brand-orange">{fmtQty(l.buy)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{fmtMoney(l.price)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{fmtMoney(l.cost)}</td>
          <td className="px-4 py-2.5 text-xs text-neutral-500">{l.products.map((p) => PRODUCT_SHORT[p]).join(', ')}</td>
        </tr>
      ))}
    </>
  )
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{value}</div>
      {note && <div className="text-xs text-amber-600 dark:text-amber-400">{note}</div>}
    </div>
  )
}
