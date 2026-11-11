import type { ProductType } from '../../types/machine'
import { PRODUCT_LABELS } from '../../types/machine'

interface ProductBadgeProps {
  product: ProductType
  size?: 'sm' | 'md'
}

export default function ProductBadge({ product, size = 'md' }: ProductBadgeProps) {
  const classes =
    size === 'md'
      ? 'px-2 py-0.5 rounded text-sm font-medium bg-brand-dark text-white'
      : 'px-1.5 py-0.5 rounded text-[11px] font-medium bg-brand-dark text-white'
  return <span className={classes}>{PRODUCT_LABELS[product]}</span>
}
