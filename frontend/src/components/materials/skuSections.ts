import type { Material } from '../../types/material'

// Seções da lista de materiais, pelo começo do SKU (igual ao sistema de SKU):
// ELE-RES-10 -> "Elétrica / Eletrônica" › "Resistor"
export const GROUP_LABELS: Record<string, string> = {
  ELE: 'Elétrica / Eletrônica',
  EST: 'Estrutural',
  EMB: 'Embalagens / Outros',
}
export const CLASS_LABELS: Record<string, string> = {
  'ELE-RES': 'Resistor', 'ELE-CAP': 'Capacitor', 'ELE-LED': 'LED', 'ELE-DIO': 'Diodo', 'ELE-TRS': 'Transistor',
  'ELE-CMP': 'Outros componentes', 'ELE-BPN': 'Barra de pino', 'ELE-CTR': 'Controladores', 'ELE-CAB': 'Cabeamento',
  'ELE-PCB': 'PCB', 'ELE-PES': 'Pesagem', 'ELE-PER': 'Periféricos', 'ELE-SUB': 'Subconjuntos',
  'EST-MET': 'Metalúrgico', 'EST-ACA': 'Acabamento', 'EST-ADE': 'Adesivos', 'EST-CAS': 'Cases', 'EST-PAR': 'Parafusos',
  'EMB-EMB': 'Embalagens',
}

export interface Section {
  key: string
  group: string
  label: string
  materials: Material[]
}

// Agrupa por GRUPO-CLASSE do SKU; materiais sem SKU ficam numa seção no fim.
export function sections(list: Material[]): Section[] {
  const map = new Map<string, Section>()
  for (const m of list) {
    const parts = (m.sku ?? '').split('-')
    const key = m.sku && parts.length >= 2 ? `${parts[0]}-${parts[1]}` : '~sem'
    let s = map.get(key)
    if (!s) {
      s = key === '~sem'
        ? { key, group: 'Sem SKU', label: '', materials: [] }
        : { key, group: GROUP_LABELS[parts[0]] ?? parts[0], label: CLASS_LABELS[key] ?? parts[1], materials: [] }
      map.set(key, s)
    }
    s.materials.push(m)
  }
  const out = [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  for (const s of out) s.materials.sort((a, b) => (a.sku ?? a.name).localeCompare(b.sku ?? b.name))
  return out
}
