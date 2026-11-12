import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Minus, X, Trash2, Search, Warehouse, Pencil, Check, ChevronRight } from 'lucide-react'
import type { LocationsData, PlacedMaterial, StorageRack } from '../../types/material'
import SkuTag from './SkuTag'
import { card, inputClass, labelClass, matches, imageUrl, lastActor, fmtQty, rackColor, rackNumberOf, locLabel } from './shared'

type Toast = (msg: string, kind: 'success' | 'error') => void

// Localização dos materiais: estantes (E1, E2...) com prateleiras (P1..Pn).
// Cada prateleira mostra o que está guardado nela; dá para adicionar, tirar
// e mover materiais, e guardar vários "sem localização" de uma vez.
export default function LocalizacaoTab({ reloadKey, onChanged, showToast, initialSearch, focusId }: {
  reloadKey: number
  initialSearch?: string
  focusId?: string // material para mostrar piscando (aberto pela coluna Local)
  onChanged: () => void
  showToast: Toast
}) {
  const [data, setData] = useState<LocationsData | null>(null)
  // nome não é pedido aqui: usa o último nome digitado em outra tela, se houver
  const actor = lastActor()
  const [search, setSearch] = useState(initialSearch ?? '')
  const [newLevels, setNewLevels] = useState('4')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) setData(await res.json())
    } catch { /* mantém o que tinha */ }
  }, [])
  useEffect(() => { load() }, [load, reloadKey])

  // ao abrir pela coluna Local: rola até o material e faz ele piscar
  // (ref, e não state: mudar state aqui cancelava o timer antes de piscar)
  // Se o material ainda não tem lugar, ele fica "aguardando" no topo até
  // você escolher onde guardar (na faixa "Aguardando lugar").
  const focusedRef = useRef(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // material a destacar: a prateleira dele se abre sozinha para ele aparecer
  const [focusTarget, setFocusTarget] = useState<string | null>(null)
  const blink = (id: string) => { setFocusTarget(id); return setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-mat-id="${id}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('loc-blink')
    void el.offsetWidth // reinicia a animação
    el.classList.add('loc-blink')
    setTimeout(() => el.classList.remove('loc-blink'), 4500)
  }, 150) }
  useEffect(() => {
    if (!focusId || !data || focusedRef.current) return
    focusedRef.current = true
    if (data.unplaced.some((m) => m.id === focusId)) setPendingId(focusId)
    else blink(focusId)
  }, [focusId, data])

  const needActor = () => false

  // chama a API e recarrega; devolve true se deu certo
  const call = async (url: string, method: string, body?: unknown, okMsg?: string) => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || 'Não foi possível salvar.', 'error')
      return false
    }
    if (okMsg) showToast(okMsg, 'success')
    await load()
    onChanged()
    return true
  }

  const assign = (ids: string[], rack: StorageRack | null, level: number | null, box: number | null, msg: string) =>
    needActor() ? Promise.resolve(false) : call('/api/locations/assign', 'PUT', { material_ids: ids, rack_id: rack?.id ?? null, level, box, actor: actor.trim() }, msg)

  // todos os materiais com a localização atual (para a busca e para "mover")
  const all = useMemo(() => {
    if (!data) return [] as (PlacedMaterial & { where: string | null })[]
    return [
      ...data.racks.flatMap((r) => r.materials.map((m) => ({ ...m, where: locLabel(r.number, m.rack_level, m.rack_box) }))),
      ...data.unplaced.map((m) => ({ ...m, where: null })),
    ]
  }, [data])

  if (!data) return <p className="text-sm text-neutral-500 py-10 text-center">Carregando…</p>

  const pending = pendingId ? all.find((m) => m.id === pendingId) ?? null : null
  // guarda o material que está aguardando e mostra ele piscando no lugar novo
  const placePending = async (rack: StorageRack, level: number, box: number | null) => {
    if (!pending) return
    const ok = await assign([pending.id], rack, level, box, `${pending.sku ?? pending.name} guardado em ${locLabel(rack.number, level, box)}.`)
    if (ok) { setPendingId(null); blink(pending.id) }
  }

  const q = search.trim()
  const found = q ? all.filter((m) => matches(m, q)) : []
  const placedCount = all.length - data.unplaced.length

  return (
    <div>
      {pending && (
        <PendingBanner material={pending} racks={data.racks} onPlace={placePending} onCancel={() => setPendingId(null)} />
      )}

      {/* topo: nome + busca + nova estante */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[240px]">
          <label className={labelClass} htmlFor="loc-search">Onde está?</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input id="loc-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU ou nome do material"
              className={`${inputClass} pl-9`} autoComplete="off" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-28">
            <label className={labelClass} htmlFor="loc-levels">Prateleiras</label>
            <input id="loc-levels" value={newLevels} onChange={(e) => setNewLevels(e.target.value)} inputMode="numeric" className={inputClass} />
          </div>
          <button
            disabled={creating}
            onClick={async () => {
              if (needActor()) return
              setCreating(true)
              const next = (data.racks[data.racks.length - 1]?.number ?? 0) + 1
              await call('/api/locations/racks', 'POST', { levels: Number(newLevels), actor: actor.trim() }, `Estante E${next} criada.`)
              setCreating(false)
            }}
            className="inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            <Plus size={15} /> Nova estante
          </button>
        </div>
      </div>

      {/* resultado da busca */}
      {q && (
        <div className={`${card} mb-4 p-3`}>
          {found.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum material com "{q}".</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {found.slice(0, 12).map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className={`inline-flex min-w-[76px] justify-center px-2 py-0.5 rounded text-xs font-bold tabular-nums ${m.where ? rackColor(rackNumberOf(m.where) ?? 1).solid : 'bg-neutral-100 dark:bg-neutral-700/60 text-neutral-500'}`}>
                    {m.where ?? 'sem lugar'}
                  </span>
                  <SkuTag sku={m.sku} image={imageUrl(m)} name={m.name} />
                  <span className="text-neutral-800 dark:text-neutral-200 truncate">{m.name}</span>
                </li>
              ))}
              {found.length > 12 && <li className="text-xs text-neutral-400">+{found.length - 12} — refine a busca</li>}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {data.racks.length} estante(s) · {placedCount} material(is) guardado(s) · {data.unplaced.length} sem localização
      </p>

      {data.racks.length === 0 ? (
        <div className={`${card} flex flex-col items-center justify-center gap-2 py-14 text-center`}>
          <Warehouse size={40} className="text-neutral-300" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma estante ainda. Informe quantas prateleiras ela tem e clique em <b>Nova estante</b>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 mb-6">
          {data.racks.map((r) => (
            <RackCard key={r.id} rack={r} all={all} highlight={q ? new Set(found.map((f) => f.id)) : null} focusId={focusTarget}
              onLevels={(levels) => !needActor() && call(`/api/locations/racks/${r.id}`, 'PATCH', { levels, actor: actor.trim() }, `E${r.number} agora tem ${levels} prateleira(s).`)}
              onNote={(note) => !needActor() && call(`/api/locations/racks/${r.id}`, 'PATCH', { note, actor: actor.trim() })}
              onDelete={() => !needActor() && call(`/api/locations/racks/${r.id}?actor=${encodeURIComponent(actor.trim())}`, 'DELETE', undefined,
                `Estante E${r.number} excluída.${r.materials.length ? ` ${r.materials.length} material(is) ficaram sem localização.` : ''}`)}
              onAssign={(ids, level, box, msg) => assign(ids, r, level, box, msg)}
              onRemove={(m) => assign([m.id], null, null, null, `${m.sku ?? m.name} ficou sem localização.`)}
              onBoxes={(level, boxes) => call('/api/locations/shelves', 'PUT', { rack_id: r.id, level, boxes, actor: actor.trim() }, `${locLabel(r.number, level)} agora tem ${boxes} caixa(s).`)}
            />
          ))}
        </div>
      )}

      {data.unplaced.length > 0 && data.racks.length > 0 && (
        <Unplaced items={data.unplaced} racks={data.racks}
          onAssign={(ids, rack, level, box) => assign(ids, rack, level, box, `${ids.length} material(is) guardado(s) em ${locLabel(rack.number, level, box)}.`)} />
      )}
    </div>
  )
}

// ── Estante ───────────────────────────────────────────────────────────────
function RackCard({ rack, all, highlight, focusId, onLevels, onNote, onDelete, onAssign, onRemove, onBoxes }: {
  focusId: string | null
  rack: StorageRack
  all: (PlacedMaterial & { where: string | null })[]
  highlight: Set<string> | null
  onLevels: (n: number) => void
  onNote: (note: string) => void
  onDelete: () => void
  onAssign: (ids: string[], level: number, box: number | null, msg: string) => Promise<boolean>
  onRemove: (m: PlacedMaterial) => void
  onBoxes: (level: number, boxes: number) => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(rack.note ?? '')
  const [confirmDel, setConfirmDel] = useState(false)
  // de cima para baixo como na estante de verdade: a última prateleira em cima, P1 embaixo
  const levels = Array.from({ length: rack.levels }, (_, i) => rack.levels - i)
  const byLevel = (lv: number) => rack.materials.filter((m) => m.rack_level === lv)
  const used = rack.materials.reduce((mx, m) => Math.max(mx, m.rack_level ?? 0), 0)
  const color = rackColor(rack.number)

  return (
    <div className={`${card} overflow-hidden border-t-4 ${color.border}`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
        <span className={`text-xl font-bold tabular-nums ${color.text}`}>E{rack.number}</span>
        <div className="flex-1 min-w-0">
          {editingNote ? (
            <form onSubmit={(e) => { e.preventDefault(); onNote(note); setEditingNote(false) }} className="flex items-center gap-1">
              <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="Ex: perto da bancada"
                className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-xs dark:bg-neutral-900 dark:text-neutral-100" />
              <button type="submit" aria-label="Salvar observação" className="p-1 text-emerald-600"><Check size={14} /></button>
            </form>
          ) : (
            <button onClick={() => setEditingNote(true)} className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-brand-orange inline-flex items-center gap-1 truncate max-w-full">
              {rack.note || 'adicionar observação'} <Pencil size={11} />
            </button>
          )}
          <div className="text-[11px] text-neutral-400">{rack.materials.length} material(is)</div>
        </div>
        <div className="flex items-center gap-1" title="Quantidade de prateleiras">
          <button onClick={() => onLevels(rack.levels - 1)} disabled={rack.levels <= 1 || rack.levels <= used} aria-label="Tirar uma prateleira"
            title={rack.levels <= used ? `P${used} ainda tem material` : 'Tirar uma prateleira'}
            className="p-1 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500 hover:border-brand-orange disabled:opacity-30"><Minus size={13} /></button>
          <span className="text-xs text-neutral-600 dark:text-neutral-300 tabular-nums w-16 text-center">{rack.levels} prat.</span>
          <button onClick={() => onLevels(rack.levels + 1)} aria-label="Adicionar uma prateleira"
            className="p-1 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500 hover:border-brand-orange"><Plus size={13} /></button>
        </div>
        <button onClick={() => setConfirmDel(true)} title="Excluir estante" aria-label="Excluir estante"
          className="p-1 text-neutral-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
        {confirmDel && (
          <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-[70]" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDel(false) }}>
            <div role="dialog" aria-modal="true" className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="p-2 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"><Trash2 size={18} /></span>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Excluir a estante E{rack.number}?</h2>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {rack.materials.length > 0
                  ? <>Os <b>{rack.materials.length} material(is)</b> guardados nela vão ficar <b>sem localização</b>. Os materiais e o estoque não são apagados.</>
                  : 'A estante está vazia.'}
              </p>
              <p className="text-xs text-neutral-400 mt-2">Não dá para desfazer.</p>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setConfirmDel(false)} autoFocus className="px-4 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">Cancelar</button>
                <button onClick={() => { setConfirmDel(false); onDelete() }} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white font-semibold hover:bg-red-700">Excluir estante</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
        {levels.map((lv) => (
          <Level key={lv} level={lv} boxes={rack.shelves?.find((s) => s.level === lv)?.boxes ?? 0} items={byLevel(lv)} all={all} highlight={highlight} focusId={focusId}
            onAdd={(m, box) => {
              const to = locLabel(rack.number, lv, box)
              onAssign([m.id], lv, box, m.where ? `${m.sku ?? m.name} mudou de ${m.where} para ${to}.` : `${m.sku ?? m.name} guardado em ${to}.`)
            }}
            onRemove={onRemove} onBoxes={(n) => onBoxes(lv, n)} />
        ))}
      </div>
    </div>
  )
}

// ── Prateleira (com caixas C1..Cn, ou sem caixas) ─────────────────────────
type Where = PlacedMaterial & { where: string | null }

function Level({ level, boxes, items, all, highlight, focusId, onAdd, onRemove, onBoxes }: {
  level: number
  focusId: string | null
  boxes: number
  items: PlacedMaterial[]
  all: Where[]
  highlight: Set<string> | null
  onAdd: (m: Where, box: number | null) => void
  onRemove: (m: PlacedMaterial) => void
  onBoxes: (n: number) => void
}) {
  const loose = items.filter((m) => !m.rack_box)
  const usedBox = items.reduce((mx, m) => Math.max(mx, m.rack_box ?? 0), 0)
  const boxNums = Array.from({ length: boxes }, (_, i) => i + 1)
  // fechada por padrão (resumo numa linha); abre sozinha se tiver material buscado/destacado
  const [open, setOpen] = useState(false)
  const hit = items.some((m) => highlight?.has(m.id) || m.id === focusId)
  useEffect(() => { if (hit) setOpen(true) }, [hit])
  const n = items.length
  const preview = items.slice(0, 3).map((m) => m.sku ?? m.name)
  return (
    <div>
    <div className="flex items-center gap-2 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex-1 min-w-0 flex items-center gap-2 text-left">
        <ChevronRight size={14} className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="w-7 shrink-0 text-xs font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">P{level}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
          {n ? `${n} ${n === 1 ? 'item' : 'itens'}` : 'vazia'}
        </span>
        {!open && n > 0 && (
          <span className="min-w-0 truncate font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
            {preview.join(' · ')}{n > 3 ? ` +${n - 3}` : ''}
          </span>
        )}
      </button>
      <BoxCounter boxes={boxes} usedBox={usedBox} onBoxes={(b) => { if (b > boxes) setOpen(true); onBoxes(b) }} />
    </div>
      {open && (
      <div className="pl-[3.25rem] pr-4 pb-2.5">
        {boxes === 0 ? (
          <Slot items={loose} all={all} highlight={highlight} onAdd={(m) => onAdd(m, null)} onRemove={onRemove} />
        ) : (
          <div className="flex flex-col gap-1.5">
            {boxNums.map((c) => (
              <div key={c} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-5 rounded border border-dashed border-neutral-300 dark:border-neutral-600 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">C{c}</span>
                <Slot items={items.filter((m) => m.rack_box === c)} all={all} highlight={highlight} onAdd={(m) => onAdd(m, c)} onRemove={onRemove} />
              </div>
            ))}
            {loose.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 w-7 text-[10px] text-neutral-400 leading-5" title="Na prateleira, fora das caixas">solto</span>
                <Slot items={loose} all={all} highlight={highlight} onAdd={(m) => onAdd(m, null)} onRemove={onRemove} />
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function BoxCounter({ boxes, usedBox, onBoxes }: { boxes: number; usedBox: number; onBoxes: (n: number) => void }) {
  return (
      <div className="shrink-0 flex items-center gap-1" title="Caixas nesta prateleira">
        <button onClick={() => onBoxes(boxes - 1)} disabled={boxes <= 0 || boxes <= usedBox} aria-label="Tirar uma caixa"
          title={boxes > 0 && boxes <= usedBox ? `C${usedBox} ainda tem material` : 'Tirar uma caixa'}
          className="p-0.5 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500 hover:border-brand-orange disabled:opacity-30"><Minus size={11} /></button>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums w-10 text-center">{boxes ? `${boxes} cx` : 'sem cx'}</span>
        <button onClick={() => onBoxes(boxes + 1)} aria-label="Adicionar uma caixa" title="Adicionar uma caixa"
          className="p-0.5 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-500 hover:border-brand-orange"><Plus size={11} /></button>
      </div>
  )
}

// Lugar onde ficam os materiais (a prateleira sem caixas, ou uma caixa)
function Slot({ items, all, highlight, onAdd, onRemove }: {
  items: PlacedMaterial[]
  all: Where[]
  highlight: Set<string> | null
  onAdd: (m: Where) => void
  onRemove: (m: PlacedMaterial) => void
}) {
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const here = new Set(items.map((i) => i.id))
  // sem lugar primeiro, depois os que estão em outro lugar (vão mudar)
  const sugg = q.trim()
    ? all.filter((m) => !here.has(m.id) && matches(m, q)).sort((a, b) => Number(!!a.where) - Number(!!b.where)).slice(0, 8)
    : []

  return (
    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
      {items.length === 0 && !adding && <span className="text-xs text-neutral-400 italic">vazia</span>}
      {items.map((m) => (
        <span key={m.id} data-mat-id={m.id} title={`${m.name} · ${fmtQty(m.current_stock)} ${m.unit}`}
          className={`group inline-flex items-center gap-1.5 max-w-full pl-2 pr-1 py-0.5 rounded-md border text-xs ${
            highlight?.has(m.id) ? 'border-brand-orange bg-brand-orange/10' : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40'
          }`}>
          {m.sku ? <SkuTag sku={m.sku} image={imageUrl(m)} name={m.name} /> : <span className="truncate max-w-[180px] text-neutral-700 dark:text-neutral-200">{m.name}</span>}
          <button onClick={() => onRemove(m)} aria-label={`Tirar ${m.name} daqui`} title="Tirar daqui (fica sem localização)"
            className="p-0.5 text-neutral-400 hover:text-red-500"><X size={12} /></button>
        </span>
      ))}
      {adding ? (
        <div className="relative w-full mt-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="SKU ou nome do material"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sugg[0]) { e.preventDefault(); onAdd(sugg[0]); setQ('') }
              if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setQ('') }
            }}
            onBlur={() => setTimeout(() => { setAdding(false); setQ('') }, 150)}
            className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100" />
          {sugg.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {sugg.map((m) => (
                <li key={m.id}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); onAdd(m); setQ('') }}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    {m.sku && <span className="font-mono text-[13px] font-medium text-brand-orange">{m.sku}</span>}
                    <span className="text-neutral-800 dark:text-neutral-200 truncate">{m.name}</span>
                    <span className={`ml-auto whitespace-nowrap ${m.where ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'}`}>
                      {m.where ? `está em ${m.where}` : 'sem lugar'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 text-xs text-brand-orange hover:underline px-1">
          <Plus size={12} /> adicionar
        </button>
      )}
    </div>
  )
}

// ── Sem localização: guardar vários de uma vez ────────────────────────────
function Unplaced({ items, racks, onAssign }: {
  items: PlacedMaterial[]
  racks: StorageRack[]
  onAssign: (ids: string[], rack: StorageRack, level: number, box: number | null) => Promise<boolean>
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [rackId, setRackId] = useState(racks[0]?.id ?? '')
  const [level, setLevel] = useState(1)
  const [box, setBox] = useState(0) // 0 = sem caixa (solto na prateleira)
  const rack = racks.find((r) => r.id === rackId) ?? racks[0]
  const shown = filter.trim() ? items.filter((m) => matches(m, filter)) : items
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allShown = shown.length > 0 && shown.every((m) => sel.has(m.id))
  const selectClass = 'border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-sm dark:bg-neutral-900 dark:text-neutral-100'

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Sem localização <span className="text-neutral-400 font-normal">({items.length})</span></h3>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar (ex: ELE-RES)"
          className="border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-sm w-48 dark:bg-neutral-900 dark:text-neutral-100" />
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Guardar {sel.size || ''} selecionado(s) em</span>
          <select value={rack?.id} onChange={(e) => { setRackId(e.target.value); setLevel(1); setBox(0) }} className={selectClass} aria-label="Estante">
            {racks.map((r) => <option key={r.id} value={r.id}>E{r.number}</option>)}
          </select>
          <select value={level} onChange={(e) => { setLevel(Number(e.target.value)); setBox(0) }} className={selectClass} aria-label="Prateleira">
            {Array.from({ length: rack?.levels ?? 1 }, (_, i) => <option key={i + 1} value={i + 1}>P{i + 1}</option>)}
          </select>
          {(() => {
            const n = rack?.shelves?.find((s) => s.level === level)?.boxes ?? 0
            return n > 0 ? (
              <select value={box} onChange={(e) => setBox(Number(e.target.value))} className={selectClass} aria-label="Caixa">
                <option value={0}>sem caixa</option>
                {Array.from({ length: n }, (_, i) => <option key={i + 1} value={i + 1}>C{i + 1}</option>)}
              </select>
            ) : null
          })()}
          <button disabled={sel.size === 0 || !rack}
            onClick={async () => { if (rack && (await onAssign([...sel], rack, level, box || null))) setSel(new Set()) }}
            className="px-3 py-1.5 rounded-md bg-brand-orange text-white font-semibold hover:bg-brand-600 disabled:opacity-40">
            Guardar
          </button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        <label className="flex items-center gap-3 px-4 py-2 text-xs text-neutral-500 border-b border-neutral-50 dark:border-neutral-800 cursor-pointer">
          <input type="checkbox" checked={allShown} className="accent-brand-orange"
            onChange={() => setSel((s) => { const n = new Set(s); shown.forEach((m) => (allShown ? n.delete(m.id) : n.add(m.id))); return n })} />
          Selecionar {filter.trim() ? 'os filtrados' : 'todos'} ({shown.length})
        </label>
        {shown.map((m) => (
          <label key={m.id} data-mat-id={m.id} className="flex items-center gap-3 px-4 py-1.5 text-sm border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-700/40 cursor-pointer">
            <input type="checkbox" checked={sel.has(m.id)} onChange={() => toggle(m.id)} className="accent-brand-orange" />
            <span className="w-48 shrink-0"><SkuTag sku={m.sku} image={imageUrl(m)} name={m.name} /></span>
            <span className="flex-1 truncate text-neutral-800 dark:text-neutral-200">{m.name}</span>
            <span className="text-xs text-neutral-400 tabular-nums">{fmtQty(m.current_stock)} {m.unit}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Material aguardando lugar (aberto pela coluna Local de um material sem lugar)
function PendingBanner({ material, racks, onPlace, onCancel }: {
  material: Where
  racks: StorageRack[]
  onPlace: (rack: StorageRack, level: number, box: number | null) => void
  onCancel: () => void
}) {
  const [rackId, setRackId] = useState(racks[0]?.id ?? '')
  const [level, setLevel] = useState(1)
  const [box, setBox] = useState(0)
  const rack = racks.find((r) => r.id === rackId)
  const boxes = rack?.shelves?.find((s) => s.level === level)?.boxes ?? 0
  const sel = 'border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-sm dark:bg-neutral-900 dark:text-neutral-100'
  return (
    <div className="sticky top-[76px] z-20 mb-4 rounded-lg border-2 border-dashed border-brand-orange bg-orange-50 dark:bg-orange-500/10 px-4 py-3 flex flex-wrap items-center gap-3 shadow-md">
      <span className="text-xs font-semibold uppercase tracking-wide text-brand-orange">Aguardando lugar</span>
      <span data-mat-id={material.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-brand-orange bg-white dark:bg-neutral-800 loc-blink">
        <SkuTag sku={material.sku} image={imageUrl(material)} name={material.name} />
        <span className="text-sm text-neutral-800 dark:text-neutral-100 max-w-[260px] truncate">{material.name}</span>
        <span className="text-xs text-neutral-400 tabular-nums">{fmtQty(material.current_stock)} {material.unit}</span>
      </span>
      {racks.length === 0 ? (
        <span className="text-sm text-neutral-600 dark:text-neutral-300">Crie uma estante abaixo para guardar.</span>
      ) : (
        <span className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          guardar em
          <select value={rackId} onChange={(e) => { setRackId(e.target.value); setLevel(1); setBox(0) }} className={sel} aria-label="Estante">
            {racks.map((r) => <option key={r.id} value={r.id}>E{r.number}</option>)}
          </select>
          <select value={level} onChange={(e) => { setLevel(Number(e.target.value)); setBox(0) }} className={sel} aria-label="Prateleira">
            {Array.from({ length: rack?.levels ?? 1 }, (_, i) => <option key={i + 1} value={i + 1}>P{i + 1}</option>)}
          </select>
          {boxes > 0 && (
            <select value={box} onChange={(e) => setBox(Number(e.target.value))} className={sel} aria-label="Caixa">
              <option value={0}>sem caixa</option>
              {Array.from({ length: boxes }, (_, i) => <option key={i + 1} value={i + 1}>C{i + 1}</option>)}
            </select>
          )}
          <button onClick={() => rack && onPlace(rack, level, box || null)} disabled={!rack}
            className="px-3 py-1.5 rounded-md bg-brand-orange text-white font-semibold hover:bg-brand-600 disabled:opacity-40">Guardar</button>
        </span>
      )}
      <button onClick={onCancel} aria-label="Deixar sem lugar" title="Deixar para depois" className="ml-auto p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"><X size={16} /></button>
    </div>
  )
}
