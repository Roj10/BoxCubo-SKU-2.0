import { useState, useEffect, useCallback } from 'react'
import { Hammer, Pencil, Cog, Plus, ListTree } from 'lucide-react'
import type { Material, BomItem } from '../../types/material'
import SkuTag from './SkuTag'
import { card, fmtQty, imageUrl, editedText } from './shared'

// Subconjuntos fabricados na Box Cubo (Shield, CPU...): quantos prontos,
// quantos dá para fabricar com o estoque atual e o que vai dentro de cada um.
export default function SubconjuntosTab({ materials, reloadKey, onFabricar, onEditarReceita, onEditar, onNovo }: {
  materials: Material[]
  reloadKey: number
  onFabricar: (m: Material) => void
  onEditarReceita: (m: Material) => void
  onEditar: (m: Material) => void
  onNovo: () => void
}) {
  const subs = materials.filter((m) => m.manufactured)
  const novo = (
    <button onClick={onNovo} className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-600 transition-colors">
      <Plus size={15} /> Novo subconjunto
    </button>
  )
  if (subs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 text-center">
        <Cog size={40} className="text-neutral-300" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum subconjunto ainda.</p>
        {novo}
      </div>
    )
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 flex-1">
          Peças montadas aqui dentro a partir de outras. Depois de criar, monte a receita e use na receita das máquinas.
        </p>
        {novo}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {subs.map((m) => (
          <SubCard key={m.id} material={m} reloadKey={reloadKey} onFabricar={() => onFabricar(m)} onReceita={() => onEditarReceita(m)} onEditar={() => onEditar(m)} />
        ))}
      </div>
    </div>
  )
}

function SubCard({ material, reloadKey, onFabricar, onReceita, onEditar }: { material: Material; reloadKey: number; onFabricar: () => void; onReceita: () => void; onEditar: () => void }) {
  const [recipe, setRecipe] = useState<BomItem[] | null>(null)
  const load = useCallback(async () => {
    const res = await fetch(`/api/bom/material/${material.id}`)
    setRecipe(res.ok ? await res.json() : [])
  }, [material.id])
  useEffect(() => { load() }, [load, reloadKey])

  // quantos dá para fabricar: o componente mais escasso manda
  const possible = recipe && recipe.length > 0
    ? Math.max(0, Math.min(...recipe.map((i) => (i.quantity > 0 ? Math.floor(i.material.current_stock / i.quantity) : Infinity))))
    : 0
  const limiting = recipe?.filter((i) => i.quantity > 0 && Math.floor(i.material.current_stock / i.quantity) === possible) ?? []

  return (
    <div className={card}>
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{material.name}</h3>
          <SkuTag sku={material.sku} image={imageUrl(material)} name={material.name} />
          {material.edited_by && <div className="text-[11px] text-neutral-400 mt-0.5">✎ {editedText(material.edited_by, material.edited_at)}</div>}
        </div>
        <div className="flex gap-1.5">
          <button onClick={onEditar} title="Nome, SKU, foto, unidade" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-brand-orange transition-colors">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={onReceita} title="O que vai dentro" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-brand-orange transition-colors">
            <ListTree size={13} /> Receita
          </button>
          <button onClick={onFabricar} disabled={!recipe?.length || possible === 0} title={recipe?.length && possible === 0 ? 'Sem estoque das peças para fabricar' : undefined} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-brand-orange text-white font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
            <Hammer size={13} /> Fabricar
          </button>
        </div>
      </div>
      <div className="px-4 py-3 flex gap-8">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Prontos em estoque</div>
          <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{fmtQty(material.current_stock)}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Dá para fabricar</div>
          <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{recipe ? possible : '—'}</div>
          {recipe && recipe.length > 0 && limiting.length > 0 && limiting.length < recipe.length && (
            <div className="text-xs text-neutral-400 max-w-[260px] truncate" title={limiting.map((l) => l.material.name).join(', ')}>
              limitado por {limiting[0].material.sku ?? limiting[0].material.name}{limiting.length > 1 ? ` e mais ${limiting.length - 1}` : ''}
            </div>
          )}
        </div>
      </div>
      {recipe && (
        <div className="px-4 pb-3">
          {recipe.length === 0 ? (
            <p className="text-xs text-neutral-500">Ainda sem receita. <button onClick={onReceita} className="text-brand-orange hover:underline">Montar receita</button></p>
          ) : (
            <details>
              <summary className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-brand-orange">
                {recipe.length} materiais na receita
              </summary>
              <ul className="mt-2 text-xs divide-y divide-neutral-100 dark:divide-neutral-700/60">
                {recipe.map((i) => (
                  <li key={i.id} className="py-1 flex items-center gap-2">
                    <SkuTag sku={i.material.sku} image={imageUrl(i.material)} name={i.material.name} />
                    <span className="text-neutral-700 dark:text-neutral-300">{i.material.name}</span>
                    <span className="ml-auto tabular-nums text-neutral-500">{fmtQty(i.quantity)} {i.material.unit}</span>
                    <span className={`w-20 text-right tabular-nums ${i.material.current_stock < i.quantity ? 'text-red-600 dark:text-red-400' : 'text-neutral-400'}`}>
                      tem {fmtQty(i.material.current_stock)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
