import { Loader2 } from 'lucide-react'

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'ghost'
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}: ButtonProps) {
  const base =
    variant === 'primary'
      ? 'inline-flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-600 active:scale-[0.98] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2'
      : 'inline-flex items-center gap-2 border border-neutral-300 text-neutral-700 px-4 py-2 rounded-md text-sm hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:ring-offset-neutral-900'

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''
  const loadingClasses = loading ? 'opacity-70 cursor-not-allowed' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${disabledClasses} ${loadingClasses} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Salvando...
        </>
      ) : (
        children
      )}
    </button>
  )
}
