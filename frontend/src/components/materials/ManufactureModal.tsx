import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Hammer, AlertTriangle } from 'lucide-react'
import type { Material, BomItem, ManufactureResult } from '../../types/material'
import Button from '../ui/Button'
import ActorInput from './ActorInput'
import { lastActor, rememberActor } from './shared'

interface ManufactureModalProps {
  material: Material
  onClose: () => void
  onSuccess: (result: ManufactureResult) => void
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('pt-BR')

// Fabricar N unidades de um subconjunto: mostra o que será baixado do estoque
// (só os componentes diretos da receita dele) e confirma.
export default function ManufactureModal({ material, onClose, onSuccess }: ManufactureModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const [qty, setQty] = useState('1')
  const [recipe, setRecipe] = useState<BomItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actor, setActor] = useState(lastActor())

  useEffect(() => {
    qtyRef.current?.focus()
    qtyRef.current?.select()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    let active = true
    fetch(`/api/bom/material/${material.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (active) setRecipe(data) })
      .catch(() => { if (active) setRecipe([]) })
    return () => { active = false }
  }, [material.id])

  const n = Number(qty)
  const validQty = Number.isFinite(n) && n > 0
  const rows = (recipe ?? []).map((item) => {
    const needed = item.quantity * (validQty ? n : 0)
    return { item, needed, short: needed > item.material.current_stock }
  })
  const shortages = rows.filter((r) => r.short)
  // quantos dá para fabricar com o estoque atual (o componente mais escasso manda)
  const counted = (recipe ?? []).filter((i) => i.quantity > 0)
  const possible = counted.length
    ? Math.max(0, Math.min(...counted.map((i) => Math.floor((i.material.current_stock + 1e-9) / i.quantity))))
    : 0
  const empty = counted.filter((i) => i.material.current_stock + 1e-9 < i.quantity) // não dá nem 1
  const tooMany = validQty && n > possible

  const handleSubmit = async () => {
    if (!validQty) {
      setError('Quantidade deve ser maior que zero.')
      return
    }
    if (!actor.trim()) {
      setError('Digite o seu nome para fabricar.')
      return
    }
    if (n > possible) return
    rememberActor(actor.trim())
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/materials/${material.id}/manufacture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: n, actor: actor.trim() }),
      })
      if (res.ok) {
        onSuccess(await res.json())
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Não foi possível fabricar.')
      }
    } catch {
      setError('Não foi possível fabricar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-2xl relative flex flex-col max-h-[90vh] m-4">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Fabricar {material.name}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Em estoque: <span className="tabular-nums">{fmt(material.current_stock)} {material.unit}</span>
          </p>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <div className="w-36">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="mf-qty">
              Quantidade ({material.unit})
            </label>
            <input
              ref={qtyRef}
              id="mf-qty"
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1" htmlFor="mf-actor">
              Seu nome <span className="text-red-500">*</span>
            </label>
            <ActorInput id="mf-actor" value={actor} onChange={setActor}
              className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100" />
          </div>
          {validQty && !tooMany && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 pb-2.5">
              Depois: <span className="tabular-nums font-medium text-neutral-700 dark:text-neutral-200">{fmt(material.current_stock + n)} {material.unit}</span>
              {recipe && recipe.length > 0 && <> · dá para fabricar até <b className="tabular-nums">{possible}</b></>}
            </p>
          )}
        </div>

        {recipe && recipe.length > 0 && possible === 0 && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            <b>Não dá para fabricar.</b> Sem estoque suficiente de: {empty.map((i) => `${i.material.name} (tem ${fmt(i.material.current_stock)} ${i.material.unit}, precisa ${fmt(i.quantity)})`).join('; ')}.
            <div className="text-xs mt-1 opacity-80">Registre a Entrada dessas peças antes de fabricar.</div>
          </div>
        )}
        {recipe && recipe.length > 0 && possible > 0 && tooMany && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex flex-wrap items-center gap-3">
            <span className="flex-1 min-w-[240px]">
              Com o estoque atual dá para fabricar no máximo <b className="tabular-nums">{possible} {material.unit}</b>. Falta: {shortages.map((s) => s.item.material.name).join(', ')}.
            </span>
            <button onClick={() => setQty(String(possible))} className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">
              Fabricar {possible}
            </button>
          </div>
        )}

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-y-auto min-h-0 flex-1">
          <div className="sticky top-0 bg-white dark:bg-neutral-800 px-3 py-2 border-b border-neutral-100 dark:border-neutral-700 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Materiais baixados do estoque{recipe && recipe.length > 0 ? ` (${recipe.length})` : ''}
          </div>
          {recipe === null ? (
            <div className="h-1 bg-brand-orange animate-pulse w-full" />
          ) : recipe.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {material.name} ainda não tem receita. Monte em Materiais › Receitas.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100 dark:border-neutral-700">
                  <th className="px-3 py-1.5 font-medium">Material</th>
                  <th className="px-3 py-1.5 font-medium text-right w-24">Por {material.unit}</th>
                  <th className="px-3 py-1.5 font-medium text-right w-24">Baixa</th>
                  <th className="px-3 py-1.5 font-medium text-right w-28">Em estoque</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, needed, short }) => (
                  <tr key={item.id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                    <td className="px-3 py-1.5 text-neutral-800 dark:text-neutral-200">
                      <span className="inline-flex items-center gap-1.5">
                        {short && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                        {item.material.name}
                        {item.material.manufactured && (
                          <span className="px-1 rounded bg-neutral-100 dark:bg-neutral-700/60 text-[10px] text-neutral-500 dark:text-neutral-300">Fabricado</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{fmt(item.quantity)} {item.material.unit}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-neutral-800 dark:text-neutral-200">{fmt(needed)} {item.material.unit}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${short ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {fmt(item.material.current_stock)} {item.material.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || !validQty || !recipe || recipe.length === 0 || tooMany || !actor.trim()}>
            {loading ? (<><Loader2 size={14} className="animate-spin" />Fabricando...</>) : (<><Hammer size={14} />Fabricar</>)}
          </Button>
        </div>
      </div>
    </div>
  )
}
