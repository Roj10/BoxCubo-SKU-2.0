import { useState } from 'react'
import { Pencil, Inbox, Loader2, Truck, History, RotateCcw, Trash2 } from 'lucide-react'
import type { Machine, ProductTab } from '../../types/machine'
import { PRODUCT_LABELS } from '../../types/machine'
import { deadlineInfo } from '../../lib/deadline'
import TypeBadge from '../ui/TypeBadge'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import SortableHeader from '../ui/SortableHeader'
import { useSortableTable } from '../../hooks/useSortableTable'

const EMPTY_BODY: Record<ProductTab, string> = {
  TODOS: 'Cadastre a primeira máquina para começar.',
  BOXCUBO_V2: 'Cadastre a primeira BoxCubo V2 para começar.',
  SLIM: 'Cadastre o primeiro Slim para começar.',
  VISION: 'Cadastre o primeiro Vision para começar.',
  EYE: 'Cadastre o primeiro EYE para começar.',
}

interface MachineTableProps {
  machines: Machine[]
  productType: ProductTab
  onEdit: (machine: Machine) => void
  onDelete?: (machine: Machine) => void
  onStartProduction?: (machine: Machine) => void
  onRegisterDelivery?: (machine: Machine) => void
  onViewHistory?: (machine: Machine) => void
  onRegisterReturn?: (machine: Machine) => void
  onRowClick?: (machine: Machine) => void
  selectedIds?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: () => void
}

export default function MachineTable({ machines, productType, onEdit, onDelete, onStartProduction, onRegisterDelivery, onViewHistory, onRegisterReturn, onRowClick, selectedIds, onToggleRow, onToggleAll }: MachineTableProps) {
  const isV2 = productType === 'BOXCUBO_V2'
  const isAll = productType === 'TODOS'
  const { sorted, sortId, direction, requestSort } = useSortableTable(machines)
  const selectable = !!selectedIds && !!onToggleRow && !!onToggleAll
  const selectedCount = selectable ? sorted.filter((m) => selectedIds!.has(m.id)).length : 0
  const allSelected = selectable && sorted.length > 0 && selectedCount === sorted.length
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set())
  const [registeringIds, setRegisteringIds] = useState<Set<string>>(new Set())
  const [returningIds, setReturningIds] = useState<Set<string>>(new Set())

  if (machines.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        heading="Nenhuma máquina cadastrada"
        body={EMPTY_BODY[productType]}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 h-9">
          <tr>
            {selectable && (
              <th className="w-10 px-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as máquinas"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < sorted.length }}
                  onChange={() => onToggleAll!()}
                  className="accent-brand-orange w-4 h-4 cursor-pointer"
                />
              </th>
            )}
            <SortableHeader label="N° Série" className="w-40" active={sortId === 'serial_number'} direction={direction} onClick={() => requestSort('serial_number', (m) => m.serial_number ?? '', 'string')} />
            {isAll && <SortableHeader label="Produto" className="w-32" active={sortId === 'product_type'} direction={direction} onClick={() => requestSort('product_type', (m) => m.product_type, 'string')} />}
            {isV2 && <SortableHeader label="MAC Address" className="w-40" active={sortId === 'mac_address'} direction={direction} onClick={() => requestSort('mac_address', (m) => m.mac_address ?? '', 'string')} />}
            <SortableHeader label="Cliente" active={sortId === 'client'} direction={direction} onClick={() => requestSort('client', (m) => m.client?.nome ?? '', 'string')} />
            <SortableHeader label="Tipo" className="w-28" active={sortId === 'type'} direction={direction} onClick={() => requestSort('type', (m) => m.type, 'string')} />
            <SortableHeader label="Status" className="w-36" active={sortId === 'status'} direction={direction} onClick={() => requestSort('status', (m) => m.status, 'string')} />
            <SortableHeader label="Prazo" className="w-28" active={sortId === 'deadline'} direction={direction} onClick={() => requestSort('deadline', (m) => m.deadline ?? '9999', 'string')} />
            {isV2 && <SortableHeader label="Plano Suporte" className="w-32" active={sortId === 'support_plan'} direction={direction} onClick={() => requestSort('support_plan', (m) => (m.support_plan ? 1 : 0), 'number')} />}
            <SortableHeader label="Cadastrado por" className="w-36" active={sortId === 'created_by'} direction={direction} onClick={() => requestSort('created_by', (m) => m.created_by, 'string')} />
            <th className="text-left px-4 py-2 w-48">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr
              key={m.id}
              onClick={onRowClick ? () => onRowClick(m) : undefined}
              className={`bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 h-12 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {selectable && (
                <td className="px-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar máquina ${m.serial_number}`}
                    checked={selectedIds!.has(m.id)}
                    onChange={() => onToggleRow!(m.id)}
                    className="accent-brand-orange w-4 h-4 cursor-pointer"
                  />
                </td>
              )}
              <td className={`px-4 py-2 font-mono ${m.serial_number ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'italic text-neutral-400 dark:text-neutral-500'}`}>{m.serial_number || 'Sem série'}</td>
              {isAll && <td className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">{PRODUCT_LABELS[m.product_type]}</td>}
              {isV2 && <td className="px-4 py-2 font-mono text-neutral-600 dark:text-neutral-300">{m.mac_address || '—'}</td>}
              <td className="px-4 py-2 max-w-xs truncate">{m.client?.nome || '—'}</td>
              <td className="px-4 py-2"><TypeBadge type={m.type} /></td>
              <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
              <td className="px-4 py-2 whitespace-nowrap">
                {(() => {
                  const info = deadlineInfo(m.deadline, m.status)
                  if (!info) return <span className="text-neutral-300 dark:text-neutral-600">—</span>
                  return (
                    <span className={`text-xs ${info.cls}`}>
                      {info.label}
                      {info.badge && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${info.badge === 'Atrasado' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                          {info.badge}
                        </span>
                      )}
                    </span>
                  )
                })()}
              </td>
              {isV2 && <td className="px-4 py-2 text-sm">{m.support_plan ? 'Sim' : 'Não'}</td>}
              <td className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300">{m.created_by}</td>
              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(m)}
                    aria-label={`Editar máquina ${m.serial_number}`}
                    title="Editar máquina"
                    className="w-8 h-8 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-brand-orange transition-colors rounded"
                  >
                    <Pencil size={16} />
                  </button>
                  {onStartProduction && m.status === 'AGUARDANDO_PRODUCAO' && (
                    <button
                      onClick={() => {
                        if (startingIds.has(m.id)) return
                        setStartingIds(prev => new Set(prev).add(m.id))
                        Promise.resolve(onStartProduction(m)).finally(() => {
                          setStartingIds(prev => { const s = new Set(prev); s.delete(m.id); return s })
                        })
                      }}
                      disabled={startingIds.has(m.id)}
                      className="text-xs px-2 py-1 rounded bg-brand-orange text-white font-semibold hover:bg-brand-600 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {startingIds.has(m.id) ? <Loader2 size={12} className="animate-spin" /> : 'Iniciar Produção'}
                    </button>
                  )}
                  {onRegisterDelivery && m.status === 'PRONTO_ENVIO' && (
                    <button
                      onClick={() => {
                        if (registeringIds.has(m.id)) return
                        setRegisteringIds(prev => new Set(prev).add(m.id))
                        Promise.resolve(onRegisterDelivery(m)).finally(() => {
                          setRegisteringIds(prev => { const s = new Set(prev); s.delete(m.id); return s })
                        })
                      }}
                      disabled={registeringIds.has(m.id)}
                      className="text-xs px-2 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {registeringIds.has(m.id) ? <Loader2 size={12} className="animate-spin" /> : <><Truck size={12} />Registrar Envio</>}
                    </button>
                  )}
                  {onRegisterReturn && m.status === 'ENTREGUE' && (
                    <button
                      onClick={() => {
                        if (returningIds.has(m.id)) return
                        setReturningIds(prev => new Set(prev).add(m.id))
                        Promise.resolve(onRegisterReturn(m)).finally(() => {
                          setReturningIds(prev => { const s = new Set(prev); s.delete(m.id); return s })
                        })
                      }}
                      disabled={returningIds.has(m.id)}
                      className="text-xs px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {returningIds.has(m.id) ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />Registrar Devolução</>}
                    </button>
                  )}
                  {onViewHistory && (
                    <button
                      onClick={() => onViewHistory(m)}
                      aria-label={`Ver histórico de ${m.serial_number}`}
                      title="Histórico (entregas e devoluções)"
                      className="w-8 h-8 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-blue-600 transition-colors rounded"
                    >
                      <History size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(m)}
                      aria-label={`Excluir máquina ${m.serial_number}`}
                      title="Excluir máquina"
                      className="w-8 h-8 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-red-600 transition-colors rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
