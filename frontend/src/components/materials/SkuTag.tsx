import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, ImageOff } from 'lucide-react'

// Código SKU do material (ex: ELE-RES-10). Clicar copia o código. Passar o
// mouse mostra a foto do material (igual ao sistema de SKU); sem foto, avisa
// onde adicionar.
export default function SkuTag({ sku, image, name }: { sku: string | null | undefined; image?: string | null; name?: string }) {
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  if (!sku) return null

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(sku)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // navegador sem permissão de área de transferência: ignora
    }
  }

  // a foto aparece fixa na tela (não é cortada pela tabela com rolagem)
  const show = () => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const below = r.bottom + 236 < window.innerHeight
    setPos({ x: Math.min(r.left, window.innerWidth - 236), y: below ? r.bottom + 6 : r.top - 236 })
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={copy}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-[13px] font-medium text-brand-orange hover:text-brand-600 dark:hover:text-orange-300 transition-colors ${
          image ? 'underline decoration-dotted underline-offset-2' : ''
        }`}
      >
        {sku}
        {copied && <Check size={13} className="text-emerald-600" />}
      </button>
      {pos &&
        createPortal(
          <div
            className="fixed z-[60] w-[230px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1.5 shadow-xl pointer-events-none"
            style={{ left: pos.x, top: pos.y }}
          >
            {image ? (
              <img src={image} alt={name ?? sku} className="w-full h-[190px] object-contain rounded bg-white" />
            ) : (
              <div className="w-full h-[190px] rounded bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center gap-1.5 text-neutral-400">
                <ImageOff size={28} />
                <span className="text-xs">Sem foto</span>
                <span className="text-[11px] px-4 text-center">Adicione na edição do material</span>
              </div>
            )}
            <div className="px-1 pt-1 text-[11px] text-neutral-500 truncate">
              <span className="font-mono">{sku}</span>{name ? ` · ${name}` : ''} · clique para copiar
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
