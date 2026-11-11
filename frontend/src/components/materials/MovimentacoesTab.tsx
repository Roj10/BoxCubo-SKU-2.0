import { useState, useEffect, useCallback, Fragment } from 'react'
import { Search, ChevronRight, ChevronDown, Undo2 } from 'lucide-react'
import type { MaterialMovement, MovementType } from '../../types/material'
import LoadingBar from '../ui/LoadingBar'
import SkuTag from './SkuTag'
import { card, th, theadRow, tr, tag, fmtQty, fmtDateTime, lastActor, rememberActor, inputClass } from './shared'
import ActorInput from './ActorInput'

const TYPE_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  PRODUCAO: 'Produção',
  PRODUCAO_CANCELADA: 'Produção cancelada',
  FABRICACAO: 'Fabricação',
  AJUSTE: 'Ajuste',
  ESTORNO: 'Estorno',
}

// Histórico do estoque de materiais: tudo que entrou e saiu, com quem fez.
export default function MovimentacoesTab({ reloadKey, onChanged, showToast }: {
  reloadKey: number
  onChanged: () => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [list, setList] = useState<MaterialMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<string>('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [reversing, setReversing] = useState<MaterialMovement | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/material-movements?${params}`)
      setList(res.ok ? await res.json() : [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [type, q])

  useEffect(() => {
    const t = setTimeout(fetchList, 250)
    return () => clearTimeout(t)
  }, [fetchList, reloadKey])

  return (
    <div>
      {reversing && (
        <ReverseConfirm
          movement={reversing}
          onClose={() => setReversing(null)}
          onDone={() => { setReversing(null); showToast('Movimentação estornada.', 'success'); fetchList(); onChanged() }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por SKU, material, responsável, série..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading && <LoadingBar />}
      {!loading && list.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">Nenhuma movimentação ainda.</p>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={theadRow}>
                <th className={`${th} w-8`}></th>
                <th className={`${th} w-36`}>Data</th>
                <th className={th}>Tipo</th>
                <th className={th}>Referência / obs.</th>
                <th className={`${th} text-right`}>Materiais</th>
                <th className={th}>Responsável</th>
                <th className={`${th} w-24`}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const isOpen = open === m.id
                const entrou = m.items.filter((i) => i.quantity > 0).length
                const saiu = m.items.length - entrou
                return (
                  <Fragment key={m.id}>
                    <tr className={`${tr} cursor-pointer`} onClick={() => setOpen(isOpen ? null : m.id)}>
                      <td className="px-4 py-2.5 text-neutral-400">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                      <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-300 tabular-nums whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <span className={tag}>{TYPE_LABELS[m.type] ?? m.type}</span>
                        {m.reversed_by_id && <span className="ml-1.5 text-xs text-neutral-400">estornada</span>}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                        {m.ref && <div>{m.ref}</div>}
                        {m.note && <div className="text-xs text-neutral-500 dark:text-neutral-400">{m.note}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {entrou > 0 && (
                            <span title={`${entrou} material(is) com estoque aumentado`} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/30">
                              +{entrou}
                            </span>
                          )}
                          {saiu > 0 && (
                            <span title={`${saiu} material(is) com estoque reduzido`} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/30">
                              −{saiu}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{m.actor}</td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {!m.reversed_by_id && ['ENTRADA', 'SAIDA', 'AJUSTE', 'FABRICACAO'].includes(m.type) && (
                          <button onClick={() => setReversing(m)} className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-orange transition-colors">
                            <Undo2 size={13} /> Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-neutral-50/70 dark:bg-neutral-900/40 border-b border-neutral-100 dark:border-neutral-800">
                        <td></td>
                        <td colSpan={6} className="px-4 py-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-neutral-500">
                                <th className="py-1 font-medium">Material</th>
                                <th className="py-1 font-medium text-right w-28">Movimentado</th>
                                <th className="py-1 font-medium text-right w-24">Antes</th>
                                <th className="py-1 font-medium text-right w-24">Depois</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.items.map((i) => (
                                <tr key={i.id}>
                                  <td className="py-1"><div className="flex items-center gap-2"><SkuTag sku={i.sku} /><span className="text-neutral-700 dark:text-neutral-300">{i.material_name}</span></div></td>
                                  <td className={`py-1 text-right tabular-nums ${i.quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                    {i.quantity > 0 ? '+' : '−'}{fmtQty(Math.abs(i.quantity))} {i.unit}
                                  </td>
                                  <td className="py-1 text-right tabular-nums text-neutral-500">{fmtQty(i.before)}</td>
                                  <td className={`py-1 text-right tabular-nums ${i.after <= 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-300'}`}>{fmtQty(i.after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ReverseConfirm({ movement, onClose, onDone, onError }: {
  movement: MaterialMovement
  onClose: () => void
  onDone: () => void
  onError: (msg: string) => void
}) {
  const [actor, setActor] = useState(lastActor())
  const [saving, setSaving] = useState(false)
  const confirm = async () => {
    if (!actor.trim()) return
    setSaving(true)
    rememberActor(actor.trim())
    try {
      const res = await fetch(`/api/material-movements/${movement.id}/estorno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: actor.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) onDone()
      else { onError(data.error || 'Não foi possível estornar.'); onClose() }
    } catch {
      onError('Não foi possível estornar.')
      onClose()
    }
  }
  return (
    <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Estornar movimentação</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Lança o contrário dos {movement.items.length} materiais desta movimentação ({TYPE_LABELS[movement.type]}).
        </p>
        <label htmlFor="rev-actor" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mt-4 mb-1">Seu nome <span className="text-red-500">*</span></label>
        <ActorInput id="rev-actor" value={actor} onChange={setActor} className={inputClass} autoFocus />
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">Cancelar</button>
          <button onClick={confirm} disabled={!actor.trim() || saving} className="px-4 py-2 text-sm rounded-md bg-brand-orange text-white font-semibold hover:bg-brand-600 disabled:opacity-50">Estornar</button>
        </div>
      </div>
    </div>
  )
}
