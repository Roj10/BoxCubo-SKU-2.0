import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface SortableHeaderProps {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
  className?: string
}

export default function SortableHeader({ label, active, direction, onClick, className = '' }: SortableHeaderProps) {
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <th aria-sort={ariaSort} className={`text-left px-4 py-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 cursor-pointer select-none hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
      >
        <span>{label}</span>
        {active && direction === 'asc' && <ChevronUp size={14} />}
        {active && direction === 'desc' && <ChevronDown size={14} />}
        {!active && <ChevronsUpDown size={14} className="opacity-40" />}
      </button>
    </th>
  )
}
