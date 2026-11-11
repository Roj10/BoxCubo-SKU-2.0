import { useState, useMemo } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { Material } from '../../types/material'
import SkuTag from './SkuTag'
import { inputClass, labelClass, matches, imageUrl } from './shared'

interface Row { material_id: string; code: string; principal: boolean }

// Novo fornecedor (nome + materiais) ou adicionar materiais a um fornecedor
// que já existe. Para cada material: o código do item nele e se ele passa a
// ser o fornecedor principal.
export default function LinkSupplierModal({ supplier, names, materials, actor, onClose, onDone, onError }: {
  supplier: string | null // null = fornecedor novo
  names: string[]
  materials: Material[]
  actor: string
  onClose: () => void
  onDone: (name: string, msg: string) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState(supplier ?? '')
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])
  const existing = supplier === null && names.find((n) => n.trim().toLowerCase() === name.trim().toLowerCase())

  const used = new Set(rows.map((r) => r.material_id))
  const suggestions = search.trim()
    ? materials.filter((m) => !m.manufactured && !used.has(m.id) && matches(m, search)).slice(0, 8)
    : []
  const add = (m: Material) => {
    // sem fornecedor ainda: este vira o principal
    setRows((r) => [...r, { material_id: m.id, code: '', principal: (m.suppliers?.length ?? 0) === 0 }])
    setSearch('')
  }
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const submit = async () => {
    if (!actor.trim()) return onError('Digite o seu nome no topo da aba Fornecedores.')
    setSaving(true)
    try {
      const res = await fetch('/api/suppliers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), actor: actor.trim(), items: rows }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { onError(data.error || 'Não foi possível salvar.'); setSaving(false); return }
      onDone(data.name, `${data.name}: ${data.added} material(is) adicionado(s)${data.updated ? `, ${data.updated} atualizado(s)` : ''}.`)
    } catch {
      onError('Não foi possível salvar.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"><X size={20} /></button>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {supplier ? `Adicionar materiais a ${supplier}` : 'Novo fornecedor'}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 mb-5">
          Escolha os materiais que {supplier ? 'ele' : 'o fornecedor'} vai fornecer e o código do item no catálogo dele.
        </p>

        {supplier === null && (
          <div className="mb-4">
            <label className={labelClass} htmlFor="link-name">Nome do fornecedor <span className="text-red-500">*</span></label>
            <input id="link-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus placeholder="Ex: Mouser, Fornell..." />
            {existing && <p className="text-xs text-neutral-500 mt-1">{existing} já existe: os materiais serão adicionados a ele.</p>}
          </div>
        )}

        <label className={labelClass} htmlFor="link-search">Materiais</label>
        <div className="relative mb-2">
          <input
            id="link-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); add(suggestions[0]) } }}
            className={inputClass}
            placeholder="Digite o SKU ou o nome (ex: ELE-CAB, parafuso)"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => add(m)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    {m.sku && <span className="font-mono text-[13px] font-medium text-brand-orange">{m.sku}</span>}
                    <span className="text-neutral-800 dark:text-neutral-200">{m.name}</span>
                    <span className="ml-auto text-xs text-neutral-400">{m.suppliers?.[0]?.name ?? 'sem fornecedor'}</span>
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
                <th className="py-2 font-medium w-40">Código do item</th>
                <th className="py-2 font-medium w-24 text-center" title="Passa a ser o 1º fornecedor (entra no pedido da Reposição)">Principal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const m = byId.get(r.material_id)
                if (!m) return null
                return (
                  <tr key={r.material_id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2"><SkuTag sku={m.sku} image={imageUrl(m)} name={m.name} /><span className="text-neutral-800 dark:text-neutral-200">{m.name}</span></div>
                      {m.suppliers?.[0] && <div className="text-xs text-neutral-400">hoje: {m.suppliers.map((s) => s.name).join(', ')}</div>}
                    </td>
                    <td className="py-2 pr-2">
                      <input value={r.code} onChange={(e) => setRow(i, { code: e.target.value })} placeholder="opcional"
                        className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100" />
                    </td>
                    <td className="py-2 text-center">
                      <input type="checkbox" checked={r.principal} onChange={(e) => setRow(i, { principal: e.target.checked })} className="accent-brand-orange" />
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Tirar da lista" className="p-1 text-neutral-400 hover:text-red-500"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50">Cancelar</button>
          <button onClick={submit} disabled={saving || !name.trim() || rows.length === 0 || !actor.trim()}
            className="px-4 py-2 text-sm rounded-md bg-brand-orange text-white font-semibold hover:bg-brand-600 disabled:opacity-50">
            {supplier ? 'Adicionar' : 'Cadastrar fornecedor'}
          </button>
        </div>
        {!actor.trim() && <p className="text-xs text-red-500 text-right mt-2">Digite o seu nome no topo da aba Fornecedores.</p>}
      </div>
    </div>
  )
}
