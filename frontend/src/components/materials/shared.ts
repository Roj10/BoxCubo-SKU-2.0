import { TEAM_MEMBERS } from '../../types/machine'
import type { ProductKey } from '../../types/material'

// Números e valores no formato brasileiro
export const fmtQty = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('pt-BR')
export const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const PRODUCT_SHORT: Record<ProductKey, string> = { BOXCUBO_V2: 'V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE' }

export const inputClass =
  'w-full border border-neutral-300 dark:border-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500'
export const labelClass = 'block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1'
export const card = 'bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700'
export const th = 'px-4 py-2.5 font-medium'
export const theadRow = 'text-left text-xs text-neutral-500 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700'
export const tr = 'border-b border-neutral-50 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-700/40'
export const tag = 'inline-block whitespace-nowrap px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300'
export const chipActive = 'px-3 py-1.5 rounded-md text-sm font-semibold bg-brand-orange text-white'
export const chipIdle = 'px-3 py-1.5 rounded-md text-sm text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-brand-orange transition-colors'

// Responsável (o sistema não tem login): lembra o último escolhido neste computador
const KEY = 'materiais-responsavel'
export const TEAM = TEAM_MEMBERS
export function lastActor(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}
export function rememberActor(name: string) {
  try { localStorage.setItem(KEY, name) } catch { /* sem armazenamento */ }
}

// Busca de material por SKU ou nome (todas as palavras precisam aparecer)
export function matches(m: { sku: string | null; name: string }, q: string) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const text = `${m.sku ?? ''} ${m.name}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

// Endereço da foto do material (null = sem foto). O "v" muda quando a foto
// muda, para o navegador não mostrar a antiga.
export function imageUrl(m: { id: string; image_updated_at?: string | null }): string | null {
  return m.image_updated_at ? `/api/materials/${m.id}/image?v=${Date.parse(m.image_updated_at)}` : null
}

// "Maria · 10/11/2026 16:30"
export function editedText(by?: string | null, at?: string | null): string {
  if (!at) return by ?? ''
  return `${by ? `${by} · ` : ''}${fmtDateTime(at)}`
}

// Reduz a foto no navegador antes de enviar (máx. 900 px, JPEG): fica com
// ~100 KB, leve para o Raspberry e para o backup.
export function resizeImage(file: File, max = 900): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.fillStyle = '#fff' // PNG transparente fica com fundo branco
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a foto.')) }
    img.src = url
  })
}

// Cor de cada estante (E1 laranja, E2 vermelha, E3 azul...). Depois da última
// cor, recomeça. As classes ficam escritas por inteiro para o Tailwind achar.
const RACK_COLORS = [
  { text: 'text-orange-500', solid: 'bg-orange-500 text-white', border: 'border-t-orange-500', soft: 'bg-orange-500/15 text-orange-700 ring-orange-500/40 dark:text-orange-300' },
  { text: 'text-red-500', solid: 'bg-red-500 text-white', border: 'border-t-red-500', soft: 'bg-red-500/15 text-red-700 ring-red-500/40 dark:text-red-300' },
  { text: 'text-blue-500', solid: 'bg-blue-500 text-white', border: 'border-t-blue-500', soft: 'bg-blue-500/15 text-blue-700 ring-blue-500/40 dark:text-blue-300' },
  { text: 'text-emerald-500', solid: 'bg-emerald-500 text-white', border: 'border-t-emerald-500', soft: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/40 dark:text-emerald-300' },
  { text: 'text-violet-500', solid: 'bg-violet-500 text-white', border: 'border-t-violet-500', soft: 'bg-violet-500/15 text-violet-700 ring-violet-500/40 dark:text-violet-300' },
  { text: 'text-yellow-500', solid: 'bg-yellow-500 text-neutral-900', border: 'border-t-yellow-500', soft: 'bg-yellow-500/15 text-yellow-700 ring-yellow-500/40 dark:text-yellow-300' },
  { text: 'text-pink-500', solid: 'bg-pink-500 text-white', border: 'border-t-pink-500', soft: 'bg-pink-500/15 text-pink-700 ring-pink-500/40 dark:text-pink-300' },
  { text: 'text-cyan-500', solid: 'bg-cyan-500 text-white', border: 'border-t-cyan-500', soft: 'bg-cyan-500/15 text-cyan-700 ring-cyan-500/40 dark:text-cyan-300' },
  { text: 'text-lime-500', solid: 'bg-lime-500 text-neutral-900', border: 'border-t-lime-500', soft: 'bg-lime-500/15 text-lime-700 ring-lime-500/40 dark:text-lime-300' },
  { text: 'text-fuchsia-500', solid: 'bg-fuchsia-500 text-white', border: 'border-t-fuchsia-500', soft: 'bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/40 dark:text-fuchsia-300' },
]
export function rackColor(n: number) {
  return RACK_COLORS[(Math.max(1, n) - 1) % RACK_COLORS.length]
}
// número da estante a partir do texto "E3 · P2"
export function rackNumberOf(location: string | null | undefined): number | null {
  const m = location?.match(/^E(\d+)/)
  return m ? Number(m[1]) : null
}

// "E1-P2-C3" (estante, prateleira, caixa); sem caixa fica "E1-P2"
export function locLabel(rack: number, level?: number | null, box?: number | null): string {
  return `E${rack}${level ? `-P${level}` : ''}${level && box ? `-C${box}` : ''}`
}
