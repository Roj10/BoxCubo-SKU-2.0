import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
}

export default function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const dotColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <div className="fixed top-4 right-4 z-[100] max-w-sm" aria-live="polite">
      <div className="bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-4 py-3 rounded-lg flex items-start gap-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_24px_rgba(0,0,0,0.4)]">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <p className="text-sm flex-1">{message}</p>
        <button
          onClick={onDismiss}
          aria-label="Fechar notificação"
          className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
