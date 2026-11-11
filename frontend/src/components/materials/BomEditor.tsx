import { useState, useEffect, useCallback, Fragment } from 'react'
import { Plus, Trash2, Check, Loader2, ChevronRight, ChevronDown, CornerDownRight, Pencil } from 'lucide-react'
import type { Material, BomItem } from '../../types/material'
import SkuTag from './SkuTag'
import { imageUrl, matches } from './shared'

const PRODUCTS = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE'] as const
type Product = typeof PRODUCTS[number]
const PRODUCT_LABELS: Record<Product, string> = {
  BOXCUBO_V2: 'BoxCubo V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE',
}

// A receita editada pertence a um produto (nível 1) ou a um subconjunto fabricado (nível 2+)
type Owner = { kind: 'product'; product: Product } | { kind: 'material'; material: Material }

interface BomEditorProps {
  materials: Material[]
  showToast: (msg: string, type: 'success' | 'error') => void
  initialMaterialId?: string | null // abre direto na receita deste subconjunto
  onEditMaterial?: (m: Material) => void // abre o formulário do material (nome, SKU, foto...)
  reloadKey?: number
}

const chipActive = 'px-4 py-1.5 rounded-md text-sm font-semibold bg-brand-orange text-white'
const chipIdle = 'px-4 py-1.5 rounded-md text-sm text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-brand-orange transition-colors'

export default function BomEditor({ materials, showToast, initialMaterialId, onEditMaterial, reloadKey }: BomEditorProps) {
  const [owner, setOwner] = useState<Owner>(() => {
    const m = initialMaterialId ? materials.find((x) => x.id === initialMaterialId && x.manufactured) : undefined
    return m ? { kind: 'material', material: m } : { kind: 'product', product: 'BOXCUBO_V2' }
  })
  const [items, setItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(false)
  const [addMaterialId, setAddMaterialId] = useState('')
  const [addQty, setAddQty] = useState('1')
  // busca do material: digita para filtrar, a lista continua aparecendo embaixo
  const [addSearch, setAddSearch] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const [adding, setAdding] = useState(false)

  const manufactured = materials.filter((m) => m.manufactured)
  const ownerKey = owner.kind === 'product' ? owner.product : owner.material.id
  const ownerLabel = owner.kind === 'product' ? PRODUCT_LABELS[owner.product] : owner.material.name
  const unitLabel = owner.kind === 'product' ? 'máquina' : owner.material.unit

  // Se o subconjunto selecionado deixou de ser fabricado (ou foi removido), volta para um produto
  useEffect(() => {
    if (owner.kind === 'material' && !manufactured.some((m) => m.id === owner.material.id)) {
      setOwner({ kind: 'product', product: 'BOXCUBO_V2' })
    }
  }, [manufactured, owner])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const url = owner.kind === 'product' ? `/api/bom/${owner.product}` : `/api/bom/material/${owner.material.id}`
      const res = await fetch(url)
      setItems(res.ok ? await res.json() : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [owner])

  // recarrega também quando um material é editado (nome, SKU, foto)
  useEffect(() => { fetchItems() }, [fetchItems, reloadKey])

  const usedIds = new Set(items.map((i) => i.material_id))
  // Disponíveis para adicionar, ordenados pelo SKU (sem SKU vão para o fim, por nome)
  const available = materials
    .filter((m) => !usedIds.has(m.id) && !(owner.kind === 'material' && m.id === owner.material.id))
    .sort((a, b) => (a.sku ?? '\uffff' + a.name).localeCompare(b.sku ?? '\uffff' + b.name))

  const filtered = addSearch.trim() && !addMaterialId ? available.filter((m) => matches(m, addSearch)) : available
  const pick = (m: Material) => {
    setAddMaterialId(m.id)
    setAddSearch(`${m.sku ? `${m.sku} · ` : ''}${m.name}`)
    setListOpen(false)
  }

  const handleAdd = async () => {
    if (!addMaterialId) return
    setAdding(true)
    try {
      const body = owner.kind === 'product'
        ? { product_type: owner.product, material_id: addMaterialId, quantity: Number(addQty) || 1 }
        : { parent_material_id: owner.material.id, material_id: addMaterialId, quantity: Number(addQty) || 1 }
      const res = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        showToast('Material adicionado à receita.', 'success')
        setAddMaterialId('')
        setAddSearch('')
        setAddQty('1')
        fetchItems()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Não foi possível adicionar.', 'error')
      }
    } catch {
      showToast('Não foi possível adicionar.', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleUpdateQty = async (item: BomItem, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return
    try {
      const res = await fetch(`/api/bom/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity } : i)))
        showToast('Quantidade atualizada.', 'success')
      } else {
        showToast('Não foi possível atualizar.', 'error')
      }
    } catch {
      showToast('Não foi possível atualizar.', 'error')
    }
  }

  const handleDelete = async (item: BomItem) => {
    try {
      const res = await fetch(`/api/bom/${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        showToast('Material removido da receita.', 'success')
      } else {
        showToast('Não foi possível remover.', 'error')
      }
    } catch {
      showToast('Não foi possível remover.', 'error')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {PRODUCTS.map((p) => (
          <button
            key={p}
            onClick={() => setOwner({ kind: 'product', product: p })}
            className={owner.kind === 'product' && owner.product === p ? chipActive : chipIdle}
          >
            {PRODUCT_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Subconjuntos fabricados internamente — receitas de nível 2+ */}
      <div className="flex flex-wrap items-center gap-1 mb-4">
        <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-1">Subconjuntos:</span>
        {manufactured.length === 0 ? (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            nenhum — marque um material como "fabricado internamente" para dar receita a ele.
          </span>
        ) : (
          manufactured.map((m) => (
            <button
              key={m.id}
              onClick={() => setOwner({ kind: 'material', material: m })}
              className={owner.kind === 'material' && owner.material.id === m.id ? chipActive : chipIdle}
            >
              {m.name}
            </button>
          ))
        )}
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Receita de {ownerLabel}
          </h3>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {owner.kind === 'product'
              ? 'Baixados do estoque ao iniciar a produção de cada máquina. Subconjuntos fabricados saem como item pronto; abra a linha para ver o que vai dentro.'
              : `Baixados do estoque a cada ${owner.material.unit} de ${owner.material.name} fabricado em Cadastrar Máquina.`}
          </p>
        </div>

        {/* Linha para adicionar material */}
        <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-700 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Material</label>
            <div className="relative">
              <input
                value={addSearch}
                onChange={(e) => { setAddSearch(e.target.value); setAddMaterialId(''); setListOpen(true); setHl(0) }}
                onFocus={() => setListOpen(true)}
                onBlur={() => setTimeout(() => setListOpen(false), 150)}
                onKeyDown={(e) => {
                  const list = filtered
                  if (e.key === 'ArrowDown') { e.preventDefault(); setListOpen(true); setHl((h) => Math.min(h + 1, list.length - 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)) }
                  else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (addMaterialId) handleAdd()
                    else if (list[hl]) pick(list[hl])
                  } else if (e.key === 'Escape') setListOpen(false)
                }}
                placeholder={available.length ? 'Digite o SKU ou o nome, ou escolha na lista' : 'Nenhum material disponível'}
                autoComplete="off"
                className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
              {listOpen && filtered.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-72 overflow-y-auto">
                  {filtered.map((m, i) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pick(m) }}
                        onMouseEnter={() => setHl(i)}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${i === hl ? 'bg-neutral-100 dark:bg-neutral-700/60' : ''}`}
                      >
                        {m.sku && <span className="font-mono text-[13px] font-medium text-brand-orange">{m.sku}</span>}
                        <span className="text-neutral-800 dark:text-neutral-200">{m.name}</span>
                        {m.manufactured && <span className="px-1 rounded bg-neutral-100 dark:bg-neutral-700/60 text-[10px] text-neutral-500 dark:text-neutral-300">Fabricado</span>}
                        <span className="ml-auto text-xs text-neutral-400 tabular-nums whitespace-nowrap">tem {m.current_stock} {m.unit}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {listOpen && addSearch.trim() && filtered.length === 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg px-3 py-2 text-sm text-neutral-400">
                  Nenhum material com "{addSearch.trim()}".
                </div>
              )}
            </div>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Qtd / {unitLabel}</label>
            <input
              type="number"
              min="0"
              step="any"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!addMaterialId || adding}
            className="inline-flex items-center gap-1.5 bg-brand-orange text-white px-3 py-2 rounded-md text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Adicionar
          </button>
        </div>

        {loading ? (
          <div className="h-1 bg-brand-orange animate-pulse w-full" />
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
            Nenhum material nesta receita ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700">
                <th className="px-4 py-2 font-medium">Material</th>
                <th className="px-4 py-2 font-medium w-44">Qtd por {unitLabel}</th>
                <th className="px-4 py-2 font-medium w-32 text-right">Em estoque</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <BomRow
                  key={`${ownerKey}-${item.id}`}
                  item={item}
                  onSave={handleUpdateQty}
                  onDelete={handleDelete}
                  onOpenRecipe={(m) => setOwner({ kind: 'material', material: m })}
                  onEdit={onEditMaterial ? () => {
                    const full = materials.find((x) => x.id === item.material_id)
                    if (full) onEditMaterial(full)
                  } : undefined}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function BomRow({
  item, onSave, onDelete, onOpenRecipe, onEdit,
}: {
  item: BomItem
  onSave: (item: BomItem, qty: number) => void
  onDelete: (item: BomItem) => void
  onOpenRecipe: (m: Material) => void
  onEdit?: () => void
}) {
  const [qty, setQty] = useState(String(item.quantity))
  const [open, setOpen] = useState(false)
  const dirty = Number(qty) !== item.quantity && Number(qty) > 0
  const components = item.material.components ?? []
  const isSub = item.material.manufactured

  return (
    <Fragment>
      <tr className="border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-700/40">
        <td className="px-4 py-2.5 text-neutral-800 dark:text-neutral-200">
          <div className="flex items-center gap-2">
            {isSub ? (
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Recolher receita' : 'Ver receita'}
                className="p-0.5 -ml-1 text-neutral-400 hover:text-brand-orange transition-colors"
              >
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <SkuTag sku={item.material.sku} image={imageUrl(item.material)} name={item.material.name} />
            <span>{item.material.name}</span>
            {onEdit && (
              <button onClick={onEdit} title={`Editar ${item.material.name} (nome, SKU, foto, fornecedor)`} aria-label="Editar material"
                className="p-1 text-neutral-300 dark:text-neutral-600 hover:text-brand-orange transition-colors">
                <Pencil size={13} />
              </button>
            )}
            {isSub && (
              <span className="inline-block whitespace-nowrap px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
                Fabricado
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-20 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
            />
            <span className="text-xs text-neutral-400 dark:text-neutral-500">{item.material.unit}</span>
            {dirty && (
              <button
                onClick={() => onSave(item, Number(qty))}
                aria-label="Salvar quantidade"
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
              >
                <Check size={16} />
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5 text-right text-neutral-500 dark:text-neutral-400 tabular-nums">
          {item.material.current_stock} {item.material.unit}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            onClick={() => onDelete(item)}
            aria-label="Remover material"
            className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </td>
      </tr>

      {/* Receita do subconjunto (nível seguinte), somente leitura */}
      {isSub && open && (
        <tr className="border-b border-neutral-50 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40">
          <td colSpan={4} className="px-4 py-2">
            <div className="pl-5">
              {components.length === 0 ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 py-1">
                  {item.material.name} ainda não tem receita.{' '}
                  <button onClick={() => onOpenRecipe(item.material)} className="text-brand-orange hover:underline">
                    Montar receita
                  </button>
                </p>
              ) : (
                <>
                  <SubTree components={components} multiplier={item.quantity} depth={0} />
                  <button
                    onClick={() => onOpenRecipe(item.material)}
                    className="mt-1.5 text-xs text-brand-orange hover:underline"
                  >
                    Editar receita de {item.material.name}
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

// Árvore somente-leitura dos níveis abaixo de um subconjunto.
// `multiplier` é a quantidade acumulada por unidade do pai de nível 1.
function SubTree({ components, multiplier, depth }: { components: BomItem[]; multiplier: number; depth: number }) {
  const fmt = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('pt-BR')
  return (
    <ul className="text-xs">
      {components.map((c) => {
        const total = c.quantity * multiplier
        const sub = c.material.components ?? []
        return (
          <li key={c.id} className="py-0.5" style={{ paddingLeft: depth * 16 }}>
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <CornerDownRight size={12} className="text-neutral-400 shrink-0" />
              <SkuTag sku={c.material.sku} image={imageUrl(c.material)} name={c.material.name} />
              <span>{c.material.name}</span>
              {c.material.manufactured && (
                <span className="px-1 rounded bg-neutral-100 dark:bg-neutral-700/60 text-[10px] text-neutral-500 dark:text-neutral-300">Fabricado</span>
              )}
              <span className="text-neutral-400 dark:text-neutral-500 tabular-nums">
                · {fmt(c.quantity)} {c.material.unit}{multiplier !== 1 ? ` (${fmt(total)} no total)` : ''}
              </span>
              <span className="text-neutral-400 dark:text-neutral-500 tabular-nums">· estoque {fmt(c.material.current_stock)}</span>
            </div>
            {sub.length > 0 && <SubTree components={sub} multiplier={total} depth={depth + 1} />}
          </li>
        )
      })}
    </ul>
  )
}
