export type Product = 'BOXCUBO_V2' | 'SLIM' | 'VISION' | 'EYE'

export interface PurchaseItem {
  material_id: string
  name: string
  unit: string
  quantity: number
  price: number | null
  purchase_link: string | null
  subtotal: number | null
  breakdown: { product_type: Product; machines: number; per_machine: number; via?: string }[]
}

export interface PurchaseList {
  quantities: Partial<Record<Product, number>>
  items: PurchaseItem[]
  total: number
  missing_price: number
}
