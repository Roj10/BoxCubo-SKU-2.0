import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import type { Material } from '../../types/material'
import Button from '../ui/Button'
import SkuTag from './SkuTag'
import { inputClass, labelClass, fmtQty, lastActor, rememberActor, matches } from './shared'
import ActorInput from './ActorInput'

type Kind = 'entrada' | 'saida'
interface Row { material_id: string; quantity: string }
interface Shortage { material_id: string; name: string; sku: string | null; unit: string; requested: number; available: number }

interface MovementModalProps {
  kind: Kind
  materials: Material[]
  initial?: { material_id: string; quantity: number }[] // ex: lista da Reposição
  initialNote?: string
  onClose: () => void
  onSuccess: (msg: string) => void
}

// Registrar entrada (chegou material) ou saída avulsa (peças para manutenção,
// perda...). Na saída, se faltar estoque, mostra o que falta e deixa seguir.
export default function MovementModal({ kind, materials, initial, initialNote, onClose, onSuccess }: MovementModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [actor, setActor] = useState(lastActor())
  const [note, setNote] = useState(initialNote ?? '')
  const [rows, setRows] = useState<Row[]>(initial?.map((i) => ({ material_id: i.material_id, quantity: String(i.quantity) })) ?? [])
  const [search, setSearch] = useState('')
  const [shortages, setShortages] = useState<Shortage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const used = new Set(rows.map((r) => r.material_id))
  const suggestions = search.trim()
    ? materials.filter((m) => !used.has(m.id) && matches(m, search)).slice(0, 8)
    : []
  const add = (m: Material) => {
    setRows((r) => [...r, { material_id: m.id, quantity: '1' }])
    setSearch('')
    setShortages(null)
  }

  const submit = async (allowShort = false) => {
    if (!actor.trim()) return setError('Digite o seu nome.')
    const items = rows.map((r) => ({ material_id: r.material_id, quantity: Number(r.quantity.replace(',', '.')) }))
    if (items.length === 0 || items.some((i) => !(i.quantity > 0))) return setError('Informe a quantidade de cada material.')
    setLoading(true)
    setError(null)
    try {
      rememberActor(actor.trim())
      const res = await fetch(`/api/material-movements/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: actor.trim(), note, items, allow_short: allowShort }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.shortages) {
        setShortages(data.shortages)
      } else if (res.ok) {
        onSuccess(kind === 'entrada' ? 'Entrada registrada.' : 'Saída registrada.')
        onClose()
      } else {
        setError(data.error || 'Não foi possível registrar.')
      }
    } catch {
      setError('Não foi possível registrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button ref={closeRef} onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600 transition-colors">
          <X size={20} />
        </button>
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {kind === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {kind === 'entrada' ? 'Material que chegou e vai para o estoque.' : 'Material que sai do estoque fora da produção (ex: peças para manutenção de cliente).'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelClass} htmlFor="mov-actor">Seu nome <span className="text-red-500">*</span></label>
            <ActorInput id="mov-actor" value={actor} onChange={setActor} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="mov-note">{kind === 'entrada' ? 'Nota / fornecedor' : 'Cliente / motivo'}</label>
            <input id="mov-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </div>
        </div>

        <label className={labelClass} htmlFor="mov-search">Materiais</label>
        <div className="relative mb-2">
          <input
            id="mov-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); add(suggestions[0]) } }}
            className={inputClass}
            placeholder="Digite o SKU ou o nome (ex: ELE-RES, parafuso M4)"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => add(m)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    {m.sku && <span className="font-mono text-[13px] font-medium text-brand-orange">{m.sku}</span>}
                    <span className="text-neutral-800 dark:text-neutral-200">{m.name}</span>
                    <span className="ml-auto text-xs text-neutral-400 tabular-nums">{fmtQty(m.current_stock)} {m.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-6 text-center border border-dashed border-neutral-200 dark:border-neutral-700 rounded-md">
            Nenhum material adicionado.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100 dark:border-neutral-700">
                <th className="py-2 font-medium">Material</th>
                <th className="py-2 font-medium w-28 text-right">Em estoque</th>
                <th className="py-2 font-medium w-36 pl-4">Quantidade</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const m = byId.get(r.material_id)
                if (!m) return null
                return (
                  <tr key={r.material_id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-2"><SkuTag sku={m.sku} /><span className="text-neutral-800 dark:text-neutral-200">{m.name}</span></div>
                    </td>
                    <td className="py-2 text-right tabular-nums text-neutral-500">{fmtQty(m.current_stock)} {m.unit}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={r.quantity}
                          inputMode="decimal"
                          onChange={(e) => { const v = e.target.value; setRows((rs) => rs.map((x, j) => (j === i ? { ...x, quantity: v } : x))); setShortages(null) }}
                          className="w-20 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100"
                        />
                        <span className="text-xs text-neutral-400">{m.unit}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => { setRows((rs) => rs.filter((_, j) => j !== i)); setShortages(null) }} aria-label="Tirar da lista" className="p-1 text-neutral-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {shortages && (
          <div className="mt-4 rounded-md border border-amber-300/70 dark:border-amber-500/40 px-3 py-2.5 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
              <AlertTriangle size={15} className="text-amber-500" /> Falta estoque
            </p>
            <ul className="mt-1 text-neutral-600 dark:text-neutral-300">
              {shortages.map((s) => (
                <li key={s.material_id}>
                  {s.sku ?? s.name}: pedido {fmtQty(s.requested)}, tem {fmtQty(s.available)} {s.unit}
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500 mt-1">Continuando, sai o que tem (o estoque fica em 0) e a falta fica anotada.</p>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {shortages ? (
            <Button variant="primary" onClick={() => submit(true)} disabled={loading}>
              {loading ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : 'Continuar mesmo assim'}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => submit(false)} disabled={loading || rows.length === 0}>
              {loading ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : kind === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
