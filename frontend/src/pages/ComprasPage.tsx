import { useState, useEffect, useMemo } from 'react'
import { Download, ShoppingCart, ExternalLink, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Product, PurchaseList } from '../types/purchase'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

const PRODUCTS: Product[] = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE']
const PRODUCT_LABELS: Record<Product, string> = {
  BOXCUBO_V2: 'BoxCubo V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE',
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtyFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export default function ComprasPage() {
  const [quantities, setQuantities] = useState<Record<Product, string>>({
    BOXCUBO_V2: '', SLIM: '', VISION: '', EYE: '',
  })
  const [list, setList] = useState<PurchaseList | null>(null)
  const [loading, setLoading] = useState(false)
  // Rascunhos dos campos editáveis (preço/link) por material
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({})
  const { showToast, ToastComponent } = useToast()

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    for (const p of PRODUCTS) {
      const n = Number(quantities[p])
      if (Number.isFinite(n) && n > 0) params.set(p, String(Math.floor(n)))
    }
    return params.toString()
  }, [quantities])

  const hasQuantities = queryString.length > 0

  // Recalcula a lista sempre que as quantidades mudam (com debounce leve)
  useEffect(() => {
    if (!hasQuantities) {
      setList(null)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/purchases?${queryString}`)
        const data: PurchaseList = res.ok ? await res.json() : { quantities: {}, items: [], total: 0, missing_price: 0 }
        setList(data)
        setPriceDrafts(Object.fromEntries(data.items.map((i) => [i.material_id, i.price != null ? String(i.price).replace('.', ',') : ''])))
        setLinkDrafts(Object.fromEntries(data.items.map((i) => [i.material_id, i.purchase_link ?? ''])))
      } catch {
        setList(null)
        showToast('Não foi possível gerar a lista.', 'error')
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString, hasQuantities])

  const refetch = async () => {
    if (!hasQuantities) return
    try {
      const res = await fetch(`/api/purchases?${queryString}`)
      if (res.ok) setList(await res.json())
    } catch { /* mantém a lista atual */ }
  }

  const savePrice = async (materialId: string) => {
    const raw = (priceDrafts[materialId] ?? '').trim()
    const item = list?.items.find((i) => i.material_id === materialId)
    const current = item?.price != null ? String(item.price).replace('.', ',') : ''
    if (raw === current) return
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: raw === '' ? null : raw }),
      })
      if (res.ok) refetch()
      else showToast('Não foi possível salvar o preço.', 'error')
    } catch {
      showToast('Não foi possível salvar o preço.', 'error')
    }
  }

  const saveLink = async (materialId: string) => {
    const raw = (linkDrafts[materialId] ?? '').trim()
    const item = list?.items.find((i) => i.material_id === materialId)
    if (raw === (item?.purchase_link ?? '')) return
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_link: raw }),
      })
      if (res.ok) refetch()
      else showToast('Não foi possível salvar o link.', 'error')
    } catch {
      showToast('Não foi possível salvar o link.', 'error')
    }
  }

  const breakdownTitle = (item: PurchaseList['items'][number]) =>
    item.breakdown
      .map((b) => `${b.machines}× ${PRODUCT_LABELS[b.product_type]} (${qtyFmt.format(b.per_machine)} por máquina${b.via ? `, via ${b.via}` : ''})`)
      .join(' + ')

  const inputClass =
    'w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500'

  return (
    <div>
      {ToastComponent}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Compras</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Informe quantas máquinas serão produzidas e gere a lista de itens para comprar.
          </p>
        </div>
        <a
          href={hasQuantities ? `/api/purchases/export.csv?${queryString}` : undefined}
          download
          aria-disabled={!hasQuantities}
          onClick={(e) => { if (!hasQuantities) e.preventDefault() }}
        >
          <Button variant="primary" disabled={!hasQuantities}>
            <Download size={15} /> Exportar planilha
          </Button>
        </a>
      </div>

      {/* Quantidades por produto */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm p-4 mb-4">
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Receita de Máquinas</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRODUCTS.map((p) => (
            <div key={p}>
              <label htmlFor={`qty-${p}`} className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                {PRODUCT_LABELS[p]}
              </label>
              <input
                id={`qty-${p}`}
                type="number"
                min="0"
                step="1"
                value={quantities[p]}
                onChange={(e) => setQuantities((q) => ({ ...q, [p]: e.target.value }))}
                placeholder="0"
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-3">
          As quantidades de itens vêm das{' '}
          <Link to="/materiais" className="text-brand-orange hover:underline">Receitas por Produto</Link>
          {' '}em Materiais. Preços e links editados aqui ficam salvos no material.
        </p>
      </div>

      {loading && <LoadingBar />}

      {!hasQuantities && (
        <div className="flex flex-col items-center justify-center min-h-[260px] gap-3 text-center">
          <ShoppingCart size={44} className="text-neutral-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            Informe a quantidade de máquinas acima para gerar a lista de compras.
          </p>
        </div>
      )}

      {hasQuantities && list && list.items.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[260px] gap-3 text-center">
          <ClipboardList size={44} className="text-neutral-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            Nenhum item na receita dos produtos selecionados.
          </p>
          <Link to="/materiais">
            <Button variant="ghost">Configurar receitas em Materiais</Button>
          </Link>
        </div>
      )}

      {hasQuantities && list && list.items.length > 0 && (
        <>
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium w-20">Unidade</th>
                  <th className="px-4 py-2.5 font-medium w-28 text-right">Quantidade</th>
                  <th className="px-4 py-2.5 font-medium w-36">Preço unit. (R$)</th>
                  <th className="px-4 py-2.5 font-medium w-32 text-right">Subtotal</th>
                  <th className="px-4 py-2.5 font-medium min-w-[220px]">Link de compra</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.material_id} className="border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-700/40">
                    <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-200 tabular-nums" title={breakdownTitle(item)}>
                      {qtyFmt.format(item.quantity)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={priceDrafts[item.material_id] ?? ''}
                        onChange={(e) => setPriceDrafts((d) => ({ ...d, [item.material_id]: e.target.value }))}
                        onBlur={() => savePrice(item.material_id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="0,00"
                        inputMode="decimal"
                        aria-label={`Preço unitário de ${item.name}`}
                        className="w-28 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-200">
                      {item.subtotal != null ? brl.format(item.subtotal) : <span className="text-neutral-400 dark:text-neutral-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={linkDrafts[item.material_id] ?? ''}
                          onChange={(e) => setLinkDrafts((d) => ({ ...d, [item.material_id]: e.target.value }))}
                          onBlur={() => saveLink(item.material_id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          placeholder="https://..."
                          aria-label={`Link de compra de ${item.name}`}
                          className="flex-1 min-w-[160px] border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
                        />
                        {item.purchase_link && (
                          <a
                            href={item.purchase_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir link de compra"
                            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-brand-orange transition-colors shrink-0"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 dark:border-neutral-700">
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                    {brl.format(list.total)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
          {list.missing_price > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {list.missing_price} {list.missing_price === 1 ? 'item sem preço — ele não entra' : 'itens sem preço — eles não entram'} no total.
            </p>
          )}
        </>
      )}
    </div>
  )
}
