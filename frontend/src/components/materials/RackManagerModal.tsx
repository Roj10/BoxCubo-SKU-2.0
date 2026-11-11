import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import LocalizacaoTab from './LocalizacaoTab'

// Janela "Estantes e prateleiras": criar/editar estantes e organizar onde cada
// material fica. Abre pelo "Gerenciar estantes" do formulário e pela coluna
// Local do estoque. `search` já abre procurando um material (ex: o SKU dele).
export default function RackManagerModal({ onClose, onChanged, search, focusId }: {
  onClose: () => void
  onChanged?: () => void
  search?: string
  focusId?: string // material para mostrar piscando no lugar dele
}) {
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-neutral-950/70 flex items-center justify-center z-[60] p-4"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto relative">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 bg-neutral-100/95 dark:bg-neutral-900/95 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Estantes e prateleiras</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Crie estantes, mude a quantidade de prateleiras e organize onde cada material fica.</p>
          </div>
          {toast && (
            <span className={`text-xs px-3 py-1.5 rounded-md ${toast.kind === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
              {toast.msg}
            </span>
          )}
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"><X size={20} /></button>
        </div>
        <div className="p-6">
          <LocalizacaoTab reloadKey={0} initialSearch={search} focusId={focusId} onChanged={() => onChanged?.()}
            showToast={(msg, kind) => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4000) }} />
        </div>
      </div>
    </div>
  )
}
