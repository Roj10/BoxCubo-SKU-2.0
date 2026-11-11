import { useMemo, useState } from 'react'

export type SortType = 'string' | 'number' | 'date'
export type SortDirection = 'asc' | 'desc'

type Accessor<T> = (item: T) => unknown

interface SortState<T> {
  id: string
  accessor: Accessor<T>
  type: SortType
}

function compareValues(a: unknown, b: unknown, type: SortType): number {
  if (type === 'string') {
    const sa = a == null ? '' : String(a)
    const sb = b == null ? '' : String(b)
    return sa.localeCompare(sb, 'pt-BR', { sensitivity: 'base', numeric: true })
  }
  if (type === 'number') {
    const na = a == null ? -Infinity : Number(a)
    const nb = b == null ? -Infinity : Number(b)
    return na - nb
  }
  // date
  const da = a == null ? 0 : new Date(a as string | number | Date).getTime()
  const db = b == null ? 0 : new Date(b as string | number | Date).getTime()
  return da - db
}

export function useSortableTable<T>(items: T[]) {
  const [sort, setSort] = useState<SortState<T> | null>(null)
  const [direction, setDirection] = useState<SortDirection>('asc')

  const requestSort = (id: string, accessor: Accessor<T>, type: SortType) => {
    if (!sort || sort.id !== id) {
      // Coluna diferente (ou primeira ordenação): começa em asc
      setSort({ id, accessor, type })
      setDirection('asc')
      return
    }
    // Mesma coluna: ciclo asc → desc → none
    if (direction === 'asc') {
      setDirection('desc')
    } else {
      setSort(null)
      setDirection('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sort) return items
    const copy = [...items]
    copy.sort((a, b) => {
      const result = compareValues(sort.accessor(a), sort.accessor(b), sort.type)
      return direction === 'desc' ? -result : result
    })
    return copy
  }, [items, sort, direction])

  return {
    sorted,
    sortId: sort ? sort.id : null,
    direction,
    requestSort,
  }
}
