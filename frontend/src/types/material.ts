export interface Material {
  id: string
  name: string
  sku: string | null // código SKU (GRUPO-CLASSE-FINAL), opcional
  unit: string
  current_stock: number
  full_stock: number
  price: number | null
  purchase_link: string | null
  manufactured: boolean // subconjunto fabricado internamente (tem receita própria)
  suppliers?: MaterialSupplier[] // fornecedores (o primeiro é o principal)
  image_updated_at?: string | null // tem foto quando preenchido (muda a cada foto nova)
  rack_id?: string | null // estante onde fica guardado
  rack_level?: number | null // prateleira (1 = P1)
  rack_box?: number | null // caixa (1 = C1); vazio = solto na prateleira
  location?: string | null // "E1-P2-C3" (pronto para mostrar)
  edited_by?: string | null // quem fez a última edição do cadastro
  edited_at?: string | null
  minimum?: number // estoque mínimo (material para N máquinas, da Reposição)
  products?: ProductKey[] // produtos em que é usado (direto ou dentro de subconjunto)
  percent: number
  low: boolean
  created_at: string
  updated_at: string
}

// Item de receita. O pai é um produto (product_type) OU um subconjunto fabricado
// (parent_material_id). Quando o material do item é fabricado, `material.components`
// traz a receita dele (BOM multinível).
export interface BomItem {
  id: string
  product_type: string | null
  parent_material_id: string | null
  material_id: string
  quantity: number
  material: Material & { components?: BomItem[] }
}

// Resposta de POST /api/materials/:id/manufacture
export interface ManufactureResult {
  material: Material
  consumed: { name: string; quantity: number; unit: string; current: number }[]
  lowStock: { name: string; current: number; full: number }[]
}

export interface MaterialSupplier {
  id?: string
  name: string
  code: string | null // código do item no catálogo do fornecedor
  position?: number
}

export type MovementType = 'ENTRADA' | 'SAIDA' | 'PRODUCAO' | 'PRODUCAO_CANCELADA' | 'FABRICACAO' | 'AJUSTE' | 'ESTORNO'

export interface MaterialMovement {
  id: string
  type: MovementType
  actor: string
  note: string | null
  ref: string | null
  reverses_id: string | null
  reversed_by_id: string | null
  created_at: string
  items: {
    id: string
    material_id: string
    material_name: string
    sku: string | null
    unit: string
    quantity: number // positivo entrou, negativo saiu
    before: number
    after: number
  }[]
}

export type ProductKey = 'BOXCUBO_V2' | 'SLIM' | 'VISION' | 'EYE'

export interface ReplenishmentLine {
  material_id: string
  sku: string | null
  name: string
  unit: string
  current: number
  minimum: number
  buy: number
  price: number | null
  cost: number | null
  supplier: string | null
  supplier_code: string | null
  other_suppliers: string[]
  products: ProductKey[]
}

export interface Replenishment {
  targets: Record<ProductKey, number>
  lines: ReplenishmentLine[]
  total_cost: number
  without_price: number
  zeroed: number
}

export interface SupplierSummary {
  name: string
  materials: number
  principal: number
  without_code: number
  to_buy: number
  order_cost: number
}

export interface SupplierMaterial {
  material_id: string
  sku: string | null
  name: string
  unit: string
  code: string | null
  principal: boolean
  others: string[]
  current: number
  minimum: number
  buy: number
  price: number | null
  cost: number | null
  products: ProductKey[]
}

// Localização no almoxarifado: estante (E1, E2...) com prateleiras P1..Pn
export interface PlacedMaterial {
  id: string
  sku: string | null
  name: string
  unit: string
  current_stock: number
  rack_level: number | null
  rack_box: number | null
  manufactured: boolean
  image_updated_at?: string | null
}
export interface StorageRack {
  id: string
  number: number
  levels: number
  note: string | null
  materials: PlacedMaterial[]
  shelves: { level: number; boxes: number }[] // só as prateleiras com caixas
}
export interface LocationsData {
  racks: StorageRack[]
  unplaced: PlacedMaterial[]
}
