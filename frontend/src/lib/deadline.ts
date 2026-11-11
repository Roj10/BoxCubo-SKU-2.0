import type { MachineStatus } from '../types/machine'

export interface DeadlineInfo {
  label: string // dd/mm/aaaa
  cls: string // classes de cor conforme urgência
  badge: string | null // "Atrasado", "Hoje", "2d" ou null
}

// Compara apenas datas (sem hora/fuso): prazo é armazenado como meia-noite UTC
export function deadlineInfo(deadline: string | null, status: MachineStatus): DeadlineInfo | null {
  if (!deadline) return null
  const d = deadline.slice(0, 10)
  const [y, m, day] = d.split('-').map(Number)
  const label = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`

  // Entregue: prazo deixa de correr
  if (status === 'ENTREGUE') {
    return { label, cls: 'text-neutral-400 dark:text-neutral-500', badge: null }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const diffDays = Math.round((Date.parse(d) - Date.parse(todayStr)) / 86_400_000)

  if (diffDays < 0) return { label, cls: 'text-red-600 dark:text-red-400 font-semibold', badge: 'Atrasado' }
  if (diffDays === 0) return { label, cls: 'text-amber-600 dark:text-amber-400 font-semibold', badge: 'Hoje' }
  if (diffDays <= 3) return { label, cls: 'text-amber-600 dark:text-amber-400 font-semibold', badge: `${diffDays}d` }
  return { label, cls: 'text-neutral-600 dark:text-neutral-300', badge: null }
}
