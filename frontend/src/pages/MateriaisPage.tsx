import { useState, useEffect, useCallback, Fragment } from 'react'
import { Plus, Download, Pencil, Trash2, Boxes, Search, Hammer, PackagePlus, PackageMinus } from 'lucide-react'
import type { Material, ManufactureResult, ProductKey } from '../types/material'
import { PRODUCT_LABELS } from '../types/machine'
import { PRODUCT_SHORT, fmtQty, fmtMoney, imageUrl, editedText, lastActor, rememberActor, rackColor, rackNumberOf } from '../components/materials/shared'
import ActorInput from '../components/materials/ActorInput'
import { sections } from '../components/materials/skuSections'
import Button from '../components/ui/Button'
import { useToast } from '../hooks/useToast'
import MaterialFormModal from '../components/materials/MaterialFormModal'
import BomEditor from '../components/materials/BomEditor'
import ManufactureModal from '../components/materials/ManufactureModal'
import LoadingBar from '../components/ui/LoadingBar'
import SkuTag from '../components/materials/SkuTag'
import SubconjuntosTab from '../components/materials/SubconjuntosTab'
import MovimentacoesTab from '../components/materials/MovimentacoesTab'
import ReposicaoTab from '../components/materials/ReposicaoTab'
import FornecedoresTab from '../components/materials/FornecedoresTab'
import RackManagerModal from '../components/materials/RackManagerModal'
import MovementModal from '../components/materials/MovementModal'

type Tab = 'estoque' | 'receitas' | 'subconjuntos' | 'movimentacoes' | 'reposicao' | 'fornecedores'

const TABS: { id: Tab; label: string }[] = [
  { id: 'estoque', label: 'Estoque de Materiais' },
  { id: 'receitas', label: 'Receitas por Produto' },
  { id: 'subconjuntos', label: 'Subconjuntos' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'reposicao', label: 'Reposição' },
  { id: 'fornecedores', label: 'Fornecedores' },
]

export default function MateriaisPage() {
  const [tab, setTab] = useState<Tab>('estoque')
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  // formulário aberto pelo "Novo subconjunto": depois de salvar vai para a receita
  const [newSub, setNewSub] = useState(false)
  // janela de estantes aberta pela coluna Local (já procurando aquele material)
  const [rackFocus, setRackFocus] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteActor, setDeleteActor] = useState(lastActor())
  const [manufacturing, setManufacturing] = useState<Material | null>(null)
  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState<string>('ALL')
  const [lowOnly, setLowOnly] = useState(false)
  const { showToast, ToastComponent } = useToast()
  // muda sempre que o estoque muda: as abas recarregam o que mostram
  const [reloadKey, setReloadKey] = useState(0)
  const [replenishCount, setReplenishCount] = useState(0)
  const [movement, setMovement] = useState<{ kind: 'entrada' | 'saida'; initial?: { material_id: string; quantity: number }[]; note?: string } | null>(null)
  const [recipeTarget, setRecipeTarget] = useState<string | null>(null)

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/materials')
      setMaterials(res.ok ? await res.json() : [])
    } catch {
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  // nº de materiais abaixo do mínimo (aparece na aba Reposição)
  useEffect(() => {
    fetch('/api/replenishment')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReplenishCount(d.lines.length))
      .catch(() => {})
  }, [reloadKey])

  const changed = useCallback(() => {
    fetchMaterials()
    setReloadKey((k) => k + 1)
  }, [fetchMaterials])

  const handleDelete = async (m: Material) => {
    try {
      rememberActor(deleteActor.trim())
      const res = await fetch(`/api/materials/${m.id}?actor=${encodeURIComponent(deleteActor.trim())}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Material removido.', 'success')
        setConfirmDeleteId(null)
        changed()
      } else {
        showToast('Não foi possível remover.', 'error')
      }
    } catch {
      showToast('Não foi possível remover.', 'error')
    }
  }

  const lowCount = materials.filter((m) => m.low).length


  const filteredMaterials = materials.filter((m) => {
    const q = search.trim().toLowerCase()
    const text = `${m.sku ?? ''} ${m.name} ${m.location ? `${m.location} ${m.location.replace(/-/g, '')}` : ''} ${(m.suppliers ?? []).map((s) => `${s.name} ${s.code ?? ''}`).join(' ')}`.toLowerCase()
    if (q && !q.split(/\s+/).every((w) => text.includes(w))) return false
    if (productFilter !== 'ALL' && !(m.products ?? []).includes(productFilter as ProductKey)) return false
    if (lowOnly && !(m.low || ((m.minimum ?? 0) > 0 && m.current_stock < (m.minimum ?? 0)))) return false
    return true
  })

  return (
    <div>
      {ToastComponent}
      {rackFocus !== null && (
        <RackManagerModal focusId={rackFocus} onClose={() => setRackFocus(null)} onChanged={changed} />
      )}
      {manufacturing && (
        <ManufactureModal
          material={manufacturing}
          onClose={() => setManufacturing(null)}
          onSuccess={(r: ManufactureResult) => {
            showToast(`${r.material.name}: agora ${r.material.current_stock} ${r.material.unit}.`, 'success')
            changed()
          }}
        />
      )}
      {showForm && (
        <MaterialFormModal
          material={editing}
          defaultManufactured={newSub}
          onLocationsChanged={changed}
          onClose={() => { setShowForm(false); setEditing(null); setNewSub(false) }}
          onSuccess={async (msg) => {
            showToast(msg, 'success')
            await fetchMaterials()
            setReloadKey((k) => k + 1)
          }}
        />
      )}
      {movement && (
        <MovementModal
          kind={movement.kind}
          materials={materials}
          initial={movement.initial}
          initialNote={movement.note}
          onClose={() => setMovement(null)}
          onSuccess={(msg) => { showToast(msg, 'success'); changed() }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Materiais</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {materials.length} {materials.length === 1 ? 'material' : 'materiais'}
            {lowCount > 0 && <span className="text-red-500 font-medium"> · {lowCount} com estoque baixo</span>}
          </p>
        </div>
        {tab === 'movimentacoes' && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMovement({ kind: 'saida' })}>
              <PackageMinus size={15} /> Registrar saída
            </Button>
            <Button variant="primary" onClick={() => setMovement({ kind: 'entrada' })}>
              <PackagePlus size={15} /> Registrar entrada
            </Button>
          </div>
        )}
        {tab === 'estoque' && (
          <div className="flex gap-2">
            <a href="/api/materials/export.csv" download>
              <Button variant="ghost"><Download size={15} /> Exportar CSV</Button>
            </a>
            <Button variant="primary" onClick={() => { setEditing(null); setShowForm(true) }}>
              <Plus size={15} /> Novo material
            </Button>
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id !== 'receitas') setRecipeTarget(null) }}
            className={
              tab === t.id
                ? 'px-4 py-2 text-sm font-semibold text-brand-dark dark:text-neutral-100 border-b-2 border-brand-orange whitespace-nowrap'
                : 'px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 border-b-2 border-transparent hover:text-brand-dark dark:hover:text-neutral-100 transition-colors whitespace-nowrap'
            }
          >
            {t.label}
            {t.id === 'reposicao' && replenishCount > 0 && (
              <span className="ml-1.5 text-xs font-semibold tabular-nums text-brand-orange">{replenishCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'estoque' && (
        <>
          {loading && <LoadingBar />}
          {!loading && materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
              <Boxes size={44} className="text-neutral-300" />
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">Nenhum material cadastrado ainda.</p>
              <Button variant="primary" onClick={() => { setEditing(null); setShowForm(true) }}>
                <Plus size={15} /> Cadastrar primeiro material
              </Button>
            </div>
          ) : (
            <>
            {/* Busca + filtros */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por SKU, nome, fornecedor ou local (ex: E1-P2)..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className={selectClass}>
                <option value="ALL">Todas as máquinas</option>
                {(Object.keys(PRODUCT_SHORT) as ProductKey[]).map((p) => (
                  <option key={p} value={p}>Usado na {PRODUCT_LABELS[p]}</option>
                ))}
              </select>
              <button
                onClick={() => setLowOnly((v) => !v)}
                className={
                  lowOnly
                    ? 'text-sm rounded-md border border-brand-orange bg-brand-orange text-white px-3 py-2 font-medium transition-colors'
                    : 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors'
                }
              >
                Abaixo do mínimo
              </button>
            </div>

            {filteredMaterials.length === 0 ? (
              <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">Nenhum material corresponde aos filtros.</p>
            ) : (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700">
                    <th className="px-4 py-2.5 font-medium w-48">SKU</th>
                    <th className="px-4 py-2.5 font-medium">Material</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Local</th>
                    <th className="px-4 py-2.5 font-medium">Máquinas</th>
                    <th className="px-4 py-2.5 font-medium">Un.</th>
                    <th className="px-4 py-2.5 font-medium text-right">Preço unit.</th>
                    <th className="px-4 py-2.5 font-medium">Fornecedor</th>
                    <th className="px-4 py-2.5 font-medium text-right">Estoque</th>
                    <th className="px-4 py-2.5 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {sections(filteredMaterials).map((sec) => (
                    <Fragment key={sec.key}>
                      <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-700">
                        <td colSpan={9} className="px-4 py-2 text-xs">
                          <span className="text-neutral-500 dark:text-neutral-400">{sec.group}</span>
                          {sec.label && <span className="font-semibold text-neutral-800 dark:text-neutral-200"> › {sec.label}</span>}
                          <span className="text-neutral-400"> ({sec.materials.length})</span>
                        </td>
                      </tr>
                      {sec.materials.map((m) => {
                        const belowMin = (m.minimum ?? 0) > 0 && m.current_stock < (m.minimum ?? 0)
                        const principal = m.suppliers?.[0]
                        return (
                    <tr
                      key={m.id}
                      onClick={() => { setEditing(m); setShowForm(true) }}
                      title="Clique para editar"
                      className="border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-700/40 cursor-pointer"
                    >
                      <td className="px-4 py-2.5"><SkuTag sku={m.sku} image={imageUrl(m)} name={m.name} /></td>
                      <td className="px-4 py-2.5 text-neutral-800 dark:text-neutral-200">
                        <div className="flex items-center gap-2">
                          {m.name}
                          {m.edited_by && (
                            <span className="text-[11px] text-neutral-400 whitespace-nowrap" title={`Última edição: ${editedText(m.edited_by, m.edited_at)}`}>
                              ✎ {m.edited_by}
                            </span>
                          )}
                          {m.manufactured && (
                            <span className="inline-block whitespace-nowrap px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
                              Fabricado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" title="Clique para ver onde fica nas estantes"
                        onClick={(e) => { e.stopPropagation(); setRackFocus(m.id) }}>
                        {m.location ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums hover:brightness-110 hover:ring-2 hover:ring-offset-1 hover:ring-neutral-400 dark:ring-offset-neutral-800 transition ${rackColor(rackNumberOf(m.location) ?? 1).solid}`}>
                            {m.location}
                          </span>
                        ) : (
                          <span className="text-neutral-400 hover:text-brand-orange transition-colors">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          {(m.products ?? []).map((p) => (
                            <span key={p} title={PRODUCT_LABELS[p]} className="inline-block whitespace-nowrap px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
                              {PRODUCT_SHORT[p]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">{m.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{fmtMoney(m.price)}</td>
                      <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-300">
                        {principal ? (
                          <span title={principal.code ? `Código: ${principal.code}` : 'Sem código do item'}>
                            {principal.name}
                            {(m.suppliers?.length ?? 0) > 1 && <span className="text-xs text-neutral-400"> +{(m.suppliers?.length ?? 0) - 1}</span>}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <div className={
                          m.current_stock <= 0 && ((m.minimum ?? 0) > 0 || m.full_stock > 0)
                            ? 'font-semibold text-red-600 dark:text-red-400'
                            : belowMin || m.low ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'
                        }>
                          {fmtQty(m.current_stock)}
                        </div>
                        {(m.minimum ?? 0) > 0 && <div className="text-[11px] text-neutral-400">mín. {fmtQty(m.minimum ?? 0)}</div>}
                        {m.full_stock > 0 && <div className="text-[11px] text-neutral-400">cheio {fmtQty(m.full_stock)} · {m.percent}%</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {confirmDeleteId === m.id ? (
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <span className="text-red-600 font-medium">Remover?</span>
                            <ActorInput
                              id={`del-${m.id}`}
                              value={deleteActor}
                              onChange={setDeleteActor}
                              placeholder="Seu nome"
                              className="w-28 text-xs rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-2 py-1"
                            />
                            <button
                              disabled={!deleteActor.trim()}
                              onClick={() => handleDelete(m)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {m.manufactured && (
                              <button
                                onClick={() => setManufacturing(m)}
                                aria-label="Fabricar"
                                title="Fabricar (baixa os materiais da receita)"
                                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-brand-orange transition-colors"
                              >
                                <Hammer size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => { setEditing(m); setShowForm(true) }}
                              aria-label="Editar"
                              title="Editar material"
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-brand-orange transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(m.id)}
                              aria-label="Remover"
                              title="Remover material (também sai das receitas)"
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            </>
          )}
        </>
      )}

      {tab === 'receitas' && (
        <BomEditor key={recipeTarget ?? 'produtos'} materials={materials} showToast={showToast} initialMaterialId={recipeTarget} reloadKey={reloadKey}
          onEditMaterial={(m) => { setNewSub(false); setEditing(m); setShowForm(true) }} />
      )}
      {tab === 'subconjuntos' && (
        <SubconjuntosTab
          materials={materials}
          reloadKey={reloadKey}
          onFabricar={(m) => setManufacturing(m)}
          onEditarReceita={(m) => { setRecipeTarget(m.id); setTab('receitas') }}
          onEditar={(m) => { setNewSub(false); setEditing(m); setShowForm(true) }}
          onNovo={() => { setNewSub(true); setEditing(null); setShowForm(true) }}
        />
      )}
      {tab === 'movimentacoes' && <MovimentacoesTab reloadKey={reloadKey} onChanged={changed} showToast={showToast} />}
      {tab === 'reposicao' && (
        <ReposicaoTab
          reloadKey={reloadKey}
          onCount={setReplenishCount}
          onEntrada={(items) => setMovement({ kind: 'entrada', initial: items, note: 'Reposição do estoque mínimo' })}
          showToast={showToast}
        />
      )}
      {tab === 'fornecedores' && <FornecedoresTab materials={materials} reloadKey={reloadKey} onChanged={changed} showToast={showToast} />}
    </div>
  )
}
