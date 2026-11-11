import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Plus, Trash2, ArrowUp, ImagePlus, Warehouse } from 'lucide-react'
import type { Material, BomItem } from '../../types/material'
import { lastActor, rememberActor, imageUrl, editedText, resizeImage, matches } from './shared'
import SkuTag from './SkuTag'
import RackManagerModal from './RackManagerModal'
import ActorInput from './ActorInput'
import Button from '../ui/Button'

interface MaterialFormModalProps {
  material?: Material | null
  onClose: () => void
  onSuccess: (msg: string, saved?: Material) => void
  // abre já marcado como subconjunto (botão "Novo subconjunto")
  defaultManufactured?: boolean
  // estantes/localizações mudaram (para a lista do estoque se atualizar)
  onLocationsChanged?: () => void
}

const inputClass =
  'w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500'
const labelClass = 'block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1'

export default function MaterialFormModal({ material, onClose, onSuccess, defaultManufactured, onLocationsChanged }: MaterialFormModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const isEdit = !!material

  const [name, setName] = useState(material?.name ?? '')
  const [sku, setSku] = useState(material?.sku ?? '')
  const [unit, setUnit] = useState(material?.unit ?? 'un')
  const [currentStock, setCurrentStock] = useState(String(material?.current_stock ?? ''))
  const [fullStock, setFullStock] = useState(String(material?.full_stock ?? ''))
  // localização no almoxarifado (estante + prateleira + caixa)
  const [racks, setRacks] = useState<{ id: string; number: number; levels: number; shelves?: { level: number; boxes: number }[] }[]>([])
  const [rackId, setRackId] = useState(material?.rack_id ?? '')
  const [rackLevel, setRackLevel] = useState(material?.rack_level ? String(material.rack_level) : '')
  const [rackBox, setRackBox] = useState(material?.rack_box ? String(material.rack_box) : '')
  const [showRacks, setShowRacks] = useState(false)
  // carrega as estantes; depois de gerenciar, acerta o lugar deste material
  // (pode ter sido movido ou a estante excluída lá dentro)
  const loadRacks = async (syncThis = false) => {
    try {
      const r = await fetch('/api/locations')
      if (!r.ok) return
      const d: { racks: { id: string; number: number; levels: number; shelves: { level: number; boxes: number }[]; materials: { id: string; rack_level: number | null; rack_box: number | null }[] }[] } = await r.json()
      setRacks(d.racks ?? [])
      if (syncThis && material) {
        const where = d.racks.find((rk) => rk.materials.some((m) => m.id === material.id))
        const me = where?.materials.find((m) => m.id === material.id)
        setRackId(where?.id ?? '')
        setRackLevel(where && me?.rack_level ? String(me.rack_level) : '')
        setRackBox(where && me?.rack_box ? String(me.rack_box) : '')
      } else if (rackId && !d.racks.some((rk) => rk.id === rackId)) {
        setRackId('')
        setRackLevel('')
        setRackBox('')
      }
    } catch { /* sem estantes */ }
  }
  useEffect(() => { loadRacks() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const showRacksRef = useRef(false)
  showRacksRef.current = showRacks
  const selRack = racks.find((r) => r.id === rackId)
  const boxCount = selRack?.shelves?.find((s) => s.level === Number(rackLevel))?.boxes ?? 0
  const [price, setPrice] = useState(material?.price != null ? String(material.price).replace('.', ',') : '')
  const [purchaseLink, setPurchaseLink] = useState(material?.purchase_link ?? '')
  const [manufactured, setManufactured] = useState(material?.manufactured ?? defaultManufactured ?? false)
  // quem está editando: obrigatório para salvar (fica registrado no material)
  const [editor, setEditor] = useState(lastActor())
  // foto: a nova escolhida (ainda não enviada) ou "remover"
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const currentPhoto = photo?.preview ?? (removePhoto || !material ? null : imageUrl(material))
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const blob = await resizeImage(file)
      setPhoto({ blob, preview: URL.createObjectURL(blob) })
      setRemovePhoto(false)
    } catch {
      setError('Não foi possível ler a foto.')
    }
  }
  // fornecedores com o código do item em cada um (o primeiro é o principal)
  const [suppliers, setSuppliers] = useState<{ name: string; code: string }[]>(
    material?.suppliers?.map((s) => ({ name: s.name, code: s.code ?? '' })) ?? []
  )
  const [supplierNames, setSupplierNames] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/suppliers').then((r) => (r.ok ? r.json() : null)).then((d) => d && setSupplierNames(d.suppliers.map((s: { name: string }) => s.name))).catch(() => {})
  }, [])
  const setSupplier = (i: number, field: 'name' | 'code', v: string) =>
    setSuppliers((l) => l.map((s, j) => (j === i ? { ...s, [field]: v } : s)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Peças para montar (só para subconjunto): a receita dele, editada aqui mesmo
  type Part = { bom_id?: string; material_id: string; qty: string; was?: number }
  const [parts, setParts] = useState<Part[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [partSearch, setPartSearch] = useState('')
  const [originalParts, setOriginalParts] = useState<Part[]>([])
  useEffect(() => {
    fetch('/api/materials').then((r) => (r.ok ? r.json() : [])).then(setAllMaterials).catch(() => {})
    if (material?.manufactured) {
      fetch(`/api/bom/material/${material.id}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((items: BomItem[]) => {
          const list = items.map((i) => ({ bom_id: i.id, material_id: i.material_id, qty: String(i.quantity).replace('.', ','), was: i.quantity }))
          setParts(list)
          setOriginalParts(list)
        })
        .catch(() => {})
    }
  }, [material])
  const matById = new Map(allMaterials.map((m) => [m.id, m]))
  const usedParts = new Set(parts.map((p) => p.material_id))
  const partSuggestions = partSearch.trim()
    ? allMaterials.filter((m) => m.id !== material?.id && !usedParts.has(m.id) && matches(m, partSearch)).slice(0, 8)
    : []
  const addPart = (m: Material) => { setParts((l) => [...l, { material_id: m.id, qty: '1' }]); setPartSearch('') }
  const partQty = (p: Part) => Number(p.qty.replace(',', '.'))

  // grava a receita depois que o material existe: adiciona, muda quantidade, tira
  const saveParts = async (id: string, original: Part[]): Promise<string | null> => {
    const errors: string[] = []
    const keep = new Set(parts.filter((p) => p.bom_id).map((p) => p.bom_id))
    for (const o of original) {
      if (o.bom_id && !keep.has(o.bom_id)) {
        const r = await fetch(`/api/bom/${o.bom_id}`, { method: 'DELETE' })
        if (!r.ok) errors.push('remover peça')
      }
    }
    for (const p of parts) {
      const q = partQty(p)
      if (!Number.isFinite(q) || q <= 0) continue
      const name = matById.get(p.material_id)?.name ?? 'peça'
      if (p.bom_id) {
        if (q !== p.was) {
          const r = await fetch(`/api/bom/${p.bom_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: q }) })
          if (!r.ok) errors.push(name)
        }
      } else {
        const r = await fetch('/api/bom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_material_id: id, material_id: p.material_id, quantity: q }) })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          errors.push(d.error || name)
        }
      }
    }
    return errors.length ? `Algumas peças não foram salvas: ${errors.join('; ')}` : null
  }

  useEffect(() => {
    closeButtonRef.current?.focus()
    // com o gerenciador de estantes aberto, o Esc é dele (fecha só ele)
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showRacksRef.current) onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    if (!editor.trim()) {
      setError('Digite o seu nome para salvar a edição.')
      return
    }
    if (manufactured && parts.some((p) => !(partQty(p) > 0))) {
      setError('Confira as quantidades das peças para montar.')
      return
    }
    rememberActor(editor.trim())
    setLoading(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        unit: unit.trim() || 'un',
        current_stock: Number(currentStock) || 0,
        full_stock: Number(fullStock) || 0,
        price: price.trim() === '' ? null : price.trim(),
        purchase_link: purchaseLink.trim(),
        manufactured,
        suppliers: suppliers.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), code: s.code.trim() })),
        location: rackId ? { rack_id: rackId, level: rackLevel ? Number(rackLevel) : null, box: rackBox && Number(rackBox) <= boxCount ? Number(rackBox) : null } : null,
        actor: editor.trim(),
      }
      const response = await fetch(
        isEdit ? `/api/materials/${material!.id}` : '/api/materials',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (response.ok) {
        const saved: Material = await response.json()
        // receita do subconjunto (peças para montar)
        if (manufactured) {
          const partsError = await saveParts(saved.id, originalParts)
          if (partsError) {
            setError(partsError)
            onSuccess('Salvo, mas algumas peças da receita não entraram.', saved)
            return
          }
        }
        // foto: enviada depois que o material existe (precisa do id)
        const q = `?actor=${encodeURIComponent(editor.trim())}`
        if (photo) {
          const r = await fetch(`/api/materials/${saved.id}/image${q}`, {
            method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: photo.blob,
          })
          if (!r.ok) {
            setError('Material salvo, mas não foi possível salvar a foto.')
            onSuccess('Material salvo sem a foto.', saved)
            return
          }
        } else if (removePhoto && material?.image_updated_at) {
          await fetch(`/api/materials/${saved.id}/image${q}`, { method: 'DELETE' })
        }
        const kind = manufactured ? 'Subconjunto' : 'Material'
        onSuccess(isEdit ? `${kind} atualizado.` : `${kind} cadastrado.`, saved)
        onClose()
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Não foi possível salvar.')
      }
    } catch {
      setError('Não foi possível salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {showRacks && (
        <RackManagerModal onClose={() => { setShowRacks(false); loadRacks(true) }} onChanged={() => onLocationsChanged?.()} />
      )}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative max-h-[92vh] overflow-y-auto">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {isEdit ? (material!.manufactured ? 'Editar Subconjunto' : 'Editar Material') : (manufactured ? 'Novo Subconjunto' : 'Novo Material')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {material?.edited_at ? `Última edição: ${editedText(material.edited_by, material.edited_at)}` : 'Estoque de peças e insumos'}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Foto do item */}
          <div className="flex items-center gap-3">
            <div className="w-24 h-24 shrink-0 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white flex items-center justify-center overflow-hidden">
              {currentPhoto ? (
                <img src={currentPhoto} alt="Foto do material" className="w-full h-full object-contain" />
              ) : (
                <ImagePlus size={26} className="text-neutral-300" />
              )}
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm text-brand-orange hover:underline">
                {currentPhoto ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {currentPhoto && (
                <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(true) }} className="text-xs text-neutral-500 hover:text-red-500">
                  Remover foto
                </button>
              )}
              <span className="text-xs text-neutral-400 dark:text-neutral-500">Aparece ao passar o mouse no SKU.</span>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="mat-name">Nome</label>
            <input
              id="mat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Ex: Placa principal, Parafuso M3, Cabo flat..."
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="mat-sku">SKU</label>
            <input
              id="mat-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
              className={`${inputClass} font-mono`}
              placeholder="ELE-RES-10"
              maxLength={40}
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Grupo-classe-final, ex: ELE-RES-10 (resistor 10 Ω), EST-PAR-M4X10 (parafuso M4x10). Opcional.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass} htmlFor="mat-unit">Unidade</label>
              <input id="mat-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} placeholder="un" />
            </div>
            <div>
              <label className={labelClass} htmlFor="mat-current">Estoque atual</label>
              <input
                id="mat-current"
                type="number"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="mat-full">Estoque cheio</label>
              <input
                id="mat-full"
                type="number"
                min="0"
                value={fullStock}
                onChange={(e) => setFullStock(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 -mt-2">
            O alerta de estoque baixo dispara quando o atual cai a 20% do "estoque cheio".
          </p>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={labelClass + ' mb-0'}>Localização</span>
              <button type="button" onClick={() => setShowRacks(true)} className="inline-flex items-center gap-1 text-xs text-brand-orange hover:underline">
                <Warehouse size={13} /> Gerenciar estantes
              </button>
            </div>
            {racks.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Nenhuma estante cadastrada. Clique em "Gerenciar estantes" para criar.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <select value={rackId} onChange={(e) => { setRackId(e.target.value); setRackLevel(e.target.value ? '1' : ''); setRackBox('') }} className={inputClass} aria-label="Estante">
                  <option value="">Sem localização</option>
                  {racks.map((r) => <option key={r.id} value={r.id}>Estante E{r.number}</option>)}
                </select>
                <select value={rackLevel} onChange={(e) => { setRackLevel(e.target.value); setRackBox('') }} disabled={!selRack} className={inputClass} aria-label="Prateleira">
                  {!selRack && <option value="">—</option>}
                  {selRack && Array.from({ length: selRack.levels }, (_, i) => <option key={i + 1} value={String(i + 1)}>Prateleira P{i + 1}</option>)}
                </select>
                <select value={rackBox} onChange={(e) => setRackBox(e.target.value)} disabled={!selRack || boxCount === 0} className={inputClass} aria-label="Caixa"
                  title={selRack && boxCount === 0 ? 'Esta prateleira não tem caixas (crie em Gerenciar estantes)' : undefined}>
                  <option value="">{boxCount ? 'Sem caixa' : '—'}</option>
                  {Array.from({ length: boxCount }, (_, i) => <option key={i + 1} value={String(i + 1)}>Caixa C{i + 1}</option>)}
                </select>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={manufactured}
              onChange={(e) => setManufactured(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-orange"
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">Fabricado internamente</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Subconjunto montado na fábrica (ex: Shield Rasp). As peças para montar ficam logo abaixo,
                e ele é fabricado na aba Subconjuntos, baixando só as peças dele.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass} htmlFor="mat-price">Preço unit. (R$)</label>
              <input
                id="mat-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass} htmlFor="mat-link">Link de compra</label>
              <input
                id="mat-link"
                value={purchaseLink}
                onChange={(e) => setPurchaseLink(e.target.value)}
                className={inputClass}
                placeholder="https://..."
              />
            </div>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 -mt-2">
            {manufactured
              ? 'Itens fabricados não entram na lista de Compras — entram os materiais da receita deles.'
              : 'Usados na aba Compras para calcular o custo e exportar a planilha.'}
          </p>

          {manufactured && (
            <div>
              <span className={labelClass}>Peças para montar <span className="font-normal text-neutral-400">(por {unit.trim() || 'un'})</span></span>
              <div className="relative mb-2">
                <input
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && partSuggestions[0]) { e.preventDefault(); addPart(partSuggestions[0]) } }}
                  className={inputClass}
                  placeholder="Adicionar peça: digite o SKU ou o nome"
                  aria-label="Buscar peça para a receita"
                  autoComplete="off"
                />
                {partSuggestions.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {partSuggestions.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => addPart(m)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                          {m.sku && <span className="font-mono text-[13px] font-medium text-brand-orange">{m.sku}</span>}
                          <span className="text-neutral-800 dark:text-neutral-200">{m.name}</span>
                          <span className="ml-auto text-xs text-neutral-400 tabular-nums">tem {m.current_stock} {m.unit}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {parts.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Nenhuma peça ainda. Busque acima e adicione o que vai dentro de 1 {unit.trim() || 'un'}.</p>
              ) : (
                <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700/60 border border-neutral-200 dark:border-neutral-700 rounded-md">
                  {parts.map((p, i) => {
                    const m = matById.get(p.material_id)
                    return (
                      <div key={p.material_id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                        {m && <SkuTag sku={m.sku} image={imageUrl(m)} name={m.name} />}
                        <span className="flex-1 min-w-0 truncate text-neutral-800 dark:text-neutral-200">{m?.name ?? '…'}</span>
                        <input
                          value={p.qty}
                          onChange={(e) => setParts((l) => l.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                          inputMode="decimal"
                          aria-label={`Quantidade de ${m?.name ?? 'peça'}`}
                          className={`w-16 border rounded px-2 py-1 text-sm text-right tabular-nums dark:bg-neutral-900 dark:text-neutral-100 ${partQty(p) > 0 ? 'border-neutral-300 dark:border-neutral-600' : 'border-red-400'}`}
                        />
                        <span className="text-xs text-neutral-400 w-8">{m?.unit}</span>
                        <button type="button" onClick={() => setParts((l) => l.filter((_, j) => j !== i))} aria-label="Tirar peça" className="p-1 text-neutral-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!manufactured && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={labelClass + ' mb-0'}>Fornecedores</span>
                <button
                  type="button"
                  onClick={() => setSuppliers((l) => [...l, { name: '', code: '' }])}
                  className="inline-flex items-center gap-1 text-xs text-brand-orange hover:underline"
                >
                  <Plus size={13} /> Adicionar fornecedor
                </button>
              </div>
              {suppliers.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Nenhum fornecedor. O primeiro da lista é o principal (entra no pedido da Reposição).</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {suppliers.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        list="mat-supplier-names"
                        value={s.name}
                        onChange={(e) => setSupplier(i, 'name', e.target.value)}
                        className={inputClass}
                        placeholder="Fornecedor"
                        aria-label="Nome do fornecedor"
                      />
                      <input
                        value={s.code}
                        onChange={(e) => setSupplier(i, 'code', e.target.value)}
                        className={`${inputClass} font-mono w-40`}
                        placeholder="Código do item"
                        aria-label="Código do item no fornecedor"
                      />
                      {i === 0 ? (
                        <span className="text-[11px] text-neutral-500 w-16 text-center">principal</span>
                      ) : (
                        <button
                          type="button"
                          title="Tornar principal"
                          onClick={() => setSuppliers((l) => [l[i], ...l.filter((_, j) => j !== i)])}
                          className="w-16 flex justify-center p-1 text-neutral-400 hover:text-brand-orange"
                        >
                          <ArrowUp size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Tirar fornecedor"
                        onClick={() => setSuppliers((l) => l.filter((_, j) => j !== i))}
                        className="p-1 text-neutral-400 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <datalist id="mat-supplier-names">{supplierNames.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
          )}
        </div>

        {/* Quem está editando: obrigatório */}
        <div className="mt-5">
          <label className={labelClass} htmlFor="mat-editor">Seu nome <span className="text-red-500">*</span></label>
          <ActorInput
            id="mat-editor"
            value={editor}
            onChange={(v) => { setEditor(v); setError(null) }}
            className={`${inputClass} ${!editor.trim() && error ? 'border-red-400' : ''}`}
          />
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Obrigatório. Fica registrado como a última edição deste material.</p>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || !editor.trim()}>
            {loading ? (<><Loader2 size={14} className="animate-spin" />Salvando...</>) : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
