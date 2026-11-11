import { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, Search, Plus, X } from 'lucide-react'
import type { SupplierSummary, SupplierMaterial, Material } from '../../types/material'
import ActorInput from './ActorInput'
import LinkSupplierModal from './LinkSupplierModal'
import Button from '../ui/Button'
import LoadingBar from '../ui/LoadingBar'
import SkuTag from './SkuTag'
import { card, th, theadRow, tr, tag, chipActive, chipIdle, fmtQty, fmtMoney, PRODUCT_SHORT, inputClass, labelClass, matches, lastActor, rememberActor } from './shared'

const NONE = '__sem__' // item "Sem fornecedor" da lista
type Filter = 'todos' | 'sem-codigo' | 'pedido'

// Fornecedores: quem fornece cada material, o código do item em cada um,
// pedido para repor o mínimo, renomear/juntar e "não trabalhamos mais".
export default function FornecedoresTab({ materials, reloadKey, onChanged, showToast }: {
  materials: Material[]
  reloadKey: number
  onChanged: () => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [summary, setSummary] = useState<SupplierSummary[]>([])
  const [withoutSupplier, setWithoutSupplier] = useState(0)
  const [current, setCurrent] = useState<string>('')
  const [items, setItems] = useState<SupplierMaterial[] | null>(null)
  const [listSearch, setListSearch] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [modal, setModal] = useState<'renomear' | 'substituir' | null>(null)
  // quem está alterando (obrigatório para qualquer mudança nesta aba)
  const [actor, setActor] = useState(lastActor())
  const [linking, setLinking] = useState<'novo' | 'adicionar' | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null) // material_id
  const needActor = () => {
    if (actor.trim()) { rememberActor(actor.trim()); return false }
    showToast('Digite o seu nome no topo da aba para alterar fornecedores.', 'error')
    return true
  }

  const fetchSummary = useCallback(async () => {
    const res = await fetch('/api/suppliers')
    if (!res.ok) return
    const data = await res.json()
    setSummary(data.suppliers)
    setWithoutSupplier(data.without_supplier)
    setCurrent((c) => c || data.suppliers[0]?.name || (data.without_supplier ? NONE : ''))
  }, [])

  const fetchItems = useCallback(async (name: string) => {
    setItems(null)
    const res = await fetch(`/api/suppliers/materials${name === NONE ? '' : `?name=${encodeURIComponent(name)}`}`)
    setItems(res.ok ? await res.json() : [])
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary, reloadKey])
  useEffect(() => { if (current) { fetchItems(current); setQ(''); setFilter('todos') } }, [current, fetchItems, reloadKey])

  const info = summary.find((s) => s.name === current)
  const visible = useMemo(() => {
    let l = items ?? []
    if (q.trim()) l = l.filter((m) => matches(m, q) || (m.code ?? '').toLowerCase().includes(q.trim().toLowerCase()))
    if (filter === 'sem-codigo') l = l.filter((m) => !m.code)
    if (filter === 'pedido') l = l.filter((m) => m.principal && m.buy > 0)
    return l
  }, [items, q, filter])

  const saveCode = async (m: SupplierMaterial, code: string) => {
    if ((m.code ?? '') === code.trim()) return
    if (needActor()) return
    const res = await fetch('/api/suppliers/code', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id: m.material_id, name: current, code, actor: actor.trim() }),
    })
    if (res.ok) {
      setItems((l) => l?.map((x) => (x.material_id === m.material_id ? { ...x, code: code.trim() || null } : x)) ?? null)
      fetchSummary()
    } else {
      showToast('Não foi possível salvar o código.', 'error')
    }
  }

  const unlink = async (m: SupplierMaterial) => {
    if (needActor()) return
    const res = await fetch('/api/suppliers/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id: m.material_id, name: current, actor: actor.trim() }),
    })
    setUnlinking(null)
    if (res.ok) {
      showToast(`${current} tirado de ${m.sku ?? m.name}.`, 'success')
      fetchItems(current)
      fetchSummary()
      onChanged()
    } else {
      showToast('Não foi possível tirar o fornecedor.', 'error')
    }
  }

  const listed = summary.filter((s) => !listSearch.trim() || s.name.toLowerCase().includes(listSearch.trim().toLowerCase()))

  return (
    <div>
    {/* quem está alterando + novo fornecedor */}
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="w-56">
        <label className={labelClass} htmlFor="forn-actor">Seu nome <span className="text-red-500">*</span></label>
        <ActorInput id="forn-actor" value={actor} onChange={setActor} className={inputClass} />
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 pb-2.5 flex-1">Obrigatório para alterar fornecedores. Fica registrado na edição do material.</p>
      <button
        onClick={() => { if (!needActor()) setLinking('novo') }}
        className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-600 transition-colors"
      >
        <Plus size={15} /> Novo fornecedor
      </button>
    </div>
    {linking && (
      <LinkSupplierModal
        supplier={linking === 'adicionar' && current !== NONE ? current : null}
        names={summary.map((s) => s.name)}
        materials={materials}
        actor={actor}
        onClose={() => setLinking(null)}
        onDone={(name, msg) => {
          setLinking(null)
          showToast(msg, 'success')
          fetchSummary()
          if (name === current) fetchItems(name)
          else setCurrent(name)
          onChanged()
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
    )}
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5 items-start">
      {modal && current && current !== NONE && (
        <SupplierModal
          actor={actor}
          mode={modal}
          name={current}
          names={summary.map((s) => s.name)}
          items={items ?? []}
          onClose={() => setModal(null)}
          onDone={(msg, next) => {
            setModal(null)
            showToast(msg, 'success')
            setCurrent(next)
            fetchSummary()
            onChanged()
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* lista de fornecedores */}
      <div className="lg:sticky lg:top-4">
        <input
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder={`Buscar entre ${summary.length} fornecedores`}
          className={`${inputClass} mb-2`}
        />
        <div className={`${card} max-h-[calc(100vh-260px)] overflow-y-auto`}>
          {listed.map((s) => (
            <button
              key={s.name}
              onClick={() => setCurrent(s.name)}
              className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 last:border-0 transition-colors ${
                current === s.name ? 'bg-brand-50 dark:bg-neutral-700/60 border-l-2 border-l-brand-orange' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/40'
              }`}
            >
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{s.name}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {s.materials} {s.materials === 1 ? 'material' : 'materiais'}
                {s.without_code > 0 && ` · ${s.without_code} sem código`}
                {s.to_buy > 0 && <span className="text-brand-orange"> · {s.to_buy} p/ comprar</span>}
              </div>
            </button>
          ))}
          <button
            onClick={() => setCurrent(NONE)}
            className={`w-full text-left px-3 py-2.5 border-t border-dashed border-neutral-200 dark:border-neutral-700 transition-colors ${
              current === NONE ? 'bg-brand-50 dark:bg-neutral-700/60' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/40'
            }`}
          >
            <div className="text-sm italic text-neutral-600 dark:text-neutral-300">Sem fornecedor</div>
            <div className="text-xs text-neutral-500">{withoutSupplier} {withoutSupplier === 1 ? 'material' : 'materiais'}</div>
          </button>
        </div>
      </div>

      {/* materiais do fornecedor escolhido */}
      <div>
        {current === NONE ? (
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sem fornecedor</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Materiais comprados que não têm fornecedor. Para definir, edite o material na aba Estoque de Materiais.
            </p>
          </div>
        ) : info ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mr-2">{info.name}</h2>
              <button onClick={() => { if (!needActor()) setLinking('adicionar') }} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-brand-orange text-brand-orange hover:bg-brand-50 dark:hover:bg-neutral-700/40 transition-colors"><Plus size={13} /> Adicionar materiais</button>
              <button onClick={() => { if (!needActor()) setModal('renomear') }} className="text-xs px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-brand-orange transition-colors">Renomear / juntar</button>
              <button onClick={() => { if (!needActor()) setModal('substituir') }} className="text-xs px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-red-400 hover:text-red-600 transition-colors">Não trabalhamos mais</button>
            </div>
            <div className="flex flex-wrap gap-8 mb-4">
              <Kpi label="Materiais" value={`${info.materials}`} note={`principal em ${info.principal}`} />
              <Kpi label="Sem código do item" value={`${info.without_code}`} />
              <Kpi label="Para comprar" value={`${info.to_buy}`} />
              <Kpi label="Valor do pedido" value={fmtMoney(info.order_cost)} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {([['todos', `Todos (${info.materials})`], ['sem-codigo', `Sem código (${info.without_code})`], ['pedido', `Pedido (${info.to_buy})`]] as [Filter, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} className={filter === k ? chipActive : chipIdle}>{label}</button>
              ))}
              <a href={`/api/suppliers/order.csv?name=${encodeURIComponent(info.name)}`} download className="ml-auto">
                <Button variant="ghost" disabled={info.to_buy === 0}><Download size={15} /> Baixar pedido</Button>
              </a>
            </div>
          </>
        ) : null}

        {items && items.length > 0 && (
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por SKU, nome ou código do item"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        )}

        {items === null ? (
          <LoadingBar />
        ) : visible.length === 0 ? (
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-12">
            {filter === 'pedido' ? 'Nada para comprar deste fornecedor.' : filter === 'sem-codigo' ? 'Todos os materiais têm código.' : 'Nenhum material.'}
          </p>
        ) : (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Material</th>
                  {current !== NONE && <th className={`${th} w-44`}>Código no fornecedor</th>}
                  <th className={`${th} text-right`}>Estoque</th>
                  <th className={`${th} text-right`}>Mínimo</th>
                  <th className={`${th} text-right`}>Comprar</th>
                  <th className={`${th} text-right`}>Preço unit.</th>
                  <th className={th}>Usado em</th>
                  {current !== NONE && <th className={`${th} w-28`}></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.material_id} className={tr}>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">
                      <div className="flex items-center gap-2">
                        <SkuTag sku={m.sku} />
                        <span>{m.name}</span>
                        {current !== NONE && !m.principal && <span className={tag} title={`Principal: ${m.others[0] ?? '—'}`}>alternativo</span>}
                      </div>
                    </td>
                    {current !== NONE && (
                      <td className="px-4 py-2">
                        <CodeInput value={m.code ?? ''} onSave={(c) => saveCode(m, c)} />
                      </td>
                    )}
                    <td className={`px-4 py-2 text-right tabular-nums ${m.minimum > 0 && m.current < m.minimum ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-300'}`}>
                      {fmtQty(m.current)} {m.unit}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-500">{m.minimum ? fmtQty(m.minimum) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-brand-orange">{m.buy ? fmtQty(m.buy) : ''}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-500">{fmtMoney(m.price)}</td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{m.products.map((p) => PRODUCT_SHORT[p]).join(', ')}</td>
                    {current !== NONE && (
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {unlinking === m.material_id ? (
                          <span className="text-xs">
                            <span className="text-red-600 mr-1.5">Tirar?</span>
                            <button onClick={() => unlink(m)} className="px-2 py-0.5 rounded bg-red-600 text-white font-semibold mr-1">Sim</button>
                            <button onClick={() => setUnlinking(null)} className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500">Não</button>
                          </span>
                        ) : (
                          <button onClick={() => setUnlinking(m.material_id)} title={`Tirar ${current} deste material`} className="p-1 text-neutral-400 hover:text-red-500 transition-colors">
                            <X size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

// Código do item editável na própria tabela: salva ao sair do campo ou Enter.
function CodeInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      value={v}
      placeholder="sem código"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setV(value)
      }}
      className="w-40 bg-transparent border border-transparent hover:border-neutral-300 focus:border-brand-orange dark:hover:border-neutral-600 rounded px-2 py-1 font-mono text-xs text-neutral-700 dark:text-neutral-200 placeholder:italic placeholder:font-sans placeholder:text-neutral-400 focus:outline-none"
    />
  )
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{value}</div>
      {note && <div className="text-xs text-neutral-400">{note}</div>}
    </div>
  )
}

// Renomear / juntar, ou "não trabalhamos mais" (passar para outro ou só tirar)
function SupplierModal({ actor, mode, name, names, items, onClose, onDone, onError }: {
  actor: string
  mode: 'renomear' | 'substituir'
  name: string
  names: string[]
  items: SupplierMaterial[]
  onClose: () => void
  onDone: (msg: string, next: string) => void
  onError: (msg: string) => void
}) {
  const [to, setTo] = useState(mode === 'renomear' ? name : '')
  const [onlyRemove, setOnlyRemove] = useState(false)
  const [saving, setSaving] = useState(false)
  const exists = to.trim() !== name && names.includes(to.trim())
  const onlyThis = items.filter((m) => m.others.length === 0)

  const submit = async () => {
    setSaving(true)
    try {
      const url = mode === 'renomear' ? '/api/suppliers/rename' : '/api/suppliers/replace'
      const body = { from: name, to: mode === 'substituir' && onlyRemove ? '' : to.trim(), actor: actor.trim() }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { onError(data.error || 'Não foi possível salvar.'); setSaving(false); return }
      if (mode === 'renomear') onDone(exists ? `${name} juntado com ${to.trim()}.` : `Fornecedor renomeado para ${to.trim()}.`, to.trim())
      else if (body.to) onDone(`Materiais de ${name} passaram para ${body.to}.`, body.to)
      else onDone(`${name} tirado de ${data.materials} materiais${data.without_supplier?.length ? `; ${data.without_supplier.length} ficaram sem fornecedor` : ''}.`, '')
    } catch {
      onError('Não foi possível salvar.')
      setSaving(false)
    }
  }

  const valid = mode === 'renomear' ? to.trim() && to.trim() !== name : onlyRemove || (to.trim() && to.trim() !== name)
  return (
    <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {mode === 'renomear' ? 'Renomear / juntar' : `Não trabalhamos mais com ${name}`}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          {mode === 'renomear'
            ? `Troca ${name} pelo nome novo em todos os materiais. Se o nome novo já existir, os dois viram um só (o código preenchido é mantido).`
            : `${name} está em ${items.length} materiais. O que fazer com eles?`}
        </p>
        {mode === 'substituir' && (
          <div className="mt-4 flex flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <label className="flex items-start gap-2"><input type="radio" checked={!onlyRemove} onChange={() => setOnlyRemove(false)} className="mt-1 accent-brand-orange" />
              <span>Passar para outro fornecedor <span className="text-xs text-neutral-500">(assume o lugar dele; o código fica em branco)</span></span></label>
            <label className="flex items-start gap-2"><input type="radio" checked={onlyRemove} onChange={() => setOnlyRemove(true)} className="mt-1 accent-brand-orange" />
              <span>Só tirar {name} dos materiais</span></label>
          </div>
        )}
        {!(mode === 'substituir' && onlyRemove) && (
          <div className="mt-4">
            <label className={labelClass} htmlFor="sup-to">{mode === 'renomear' ? 'Novo nome' : 'Novo fornecedor'}</label>
            <input id="sup-to" list="sup-names" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} autoFocus />
            <datalist id="sup-names">{names.filter((n) => n !== name).map((n) => <option key={n} value={n} />)}</datalist>
            {exists && mode === 'renomear' && <p className="text-xs text-neutral-500 mt-1">{to.trim()} já existe: os materiais de {name} vão passar para ele.</p>}
          </div>
        )}
        {mode === 'substituir' && onlyRemove && onlyThis.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
            {onlyThis.length} {onlyThis.length === 1 ? 'material só tem' : 'materiais só têm'} {name} e {onlyThis.length === 1 ? 'vai ficar' : 'vão ficar'} sem fornecedor.
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">Cancelar</button>
          <button onClick={submit} disabled={!valid || saving} className="px-4 py-2 text-sm rounded-md bg-brand-orange text-white font-semibold hover:bg-brand-600 disabled:opacity-50">
            {mode === 'renomear' ? (exists ? 'Juntar' : 'Renomear') : onlyRemove ? `Tirar ${name}` : 'Passar os materiais'}
          </button>
        </div>
      </div>
    </div>
  )
}
