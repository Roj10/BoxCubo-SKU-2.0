import type { MachineType } from '../../types/machine'

const TYPE_LABELS: Record<MachineType, string> = {
  VENDA: 'Venda',
  ALUGUEL: 'Aluguel',
  ESTOQUE: 'Estoque',
}

interface TypeBadgeProps {
  type: MachineType
}

// Tipo não é estado — tag discreta e neutra, sem cor semântica
export default function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span className="inline-block whitespace-nowrap px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
      {TYPE_LABELS[type]}
    </span>
  )
}
