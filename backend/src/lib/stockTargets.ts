import { prisma } from '../index'
import { loadRecipeTree } from '../routes/bom'

export const PRODUCTS = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE'] as const
export type Product = (typeof PRODUCTS)[number]
export const PRODUCT_LABELS: Record<Product, string> = { BOXCUBO_V2: 'BoxCubo V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE' }

export interface MaterialNeed {
  minimum: number // estoque mínimo (soma dos produtos)
  products: Product[] // produtos que usam o material (direto ou dentro de subconjunto)
}

// Para cada material: o estoque mínimo (manter material para N máquinas de cada
// produto) e em quais produtos ele é usado. Subconjuntos fabricados são abertos
// nos componentes: quem tem mínimo são as peças de dentro, não o subconjunto.
export async function materialNeeds() {
  const targets = await prisma.productStockTarget.findMany()
  const minMachines: Record<Product, number> = { BOXCUBO_V2: 0, SLIM: 0, VISION: 0, EYE: 0 }
  for (const t of targets) if ((PRODUCTS as readonly string[]).includes(t.product_type)) minMachines[t.product_type as Product] = t.min_machines

  const needs = new Map<string, MaterialNeed>()
  const get = (id: string) => {
    let n = needs.get(id)
    if (!n) needs.set(id, (n = { minimum: 0, products: [] }))
    return n
  }
  const walk = (items: any[], product: Product, mult: number) => {
    for (const it of items) {
      const n = get(it.material_id)
      if (!n.products.includes(product)) n.products.push(product)
      const per = it.quantity * mult
      const components = it.material?.components ?? []
      if (it.material?.manufactured && components.length > 0) {
        walk(components, product, per)
      } else {
        n.minimum += per * minMachines[product]
      }
    }
  }
  for (const p of PRODUCTS) walk(await loadRecipeTree({ product_type: p }), p, 1)
  for (const n of needs.values()) n.minimum = Math.round(n.minimum * 1000) / 1000
  return { minMachines, needs }
}

// Quanto comprar para voltar ao mínimo (peça inteira para unidade "un").
export function toBuy(minimum: number, current: number, unit: string): number {
  if (minimum <= 0 || current >= minimum) return 0
  const falta = minimum - current
  return unit === 'un' ? Math.ceil(falta - 1e-9) : Math.round(falta * 1000) / 1000
}
