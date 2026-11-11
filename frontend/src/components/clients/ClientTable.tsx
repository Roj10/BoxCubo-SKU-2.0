import { Link } from 'react-router-dom'
import { Eye, Pencil, Users } from 'lucide-react'
import type { Client } from '../../types/client'
import EmptyState from '../ui/EmptyState'
import SortableHeader from '../ui/SortableHeader'
import { useSortableTable } from '../../hooks/useSortableTable'

interface ClientTableProps {
  clients: Client[]
  onEdit: (client: Client) => void
}

export default function ClientTable({ clients, onEdit }: ClientTableProps) {
  const { sorted, sortId, direction, requestSort } = useSortableTable(clients)

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        heading="Nenhum cliente cadastrado"
        body="Cadastre o primeiro cliente antes de adicionar máquinas."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 h-9">
          <tr>
            <SortableHeader label="Nome" active={sortId === 'nome'} direction={direction} onClick={() => requestSort('nome', (c) => c.nome, 'string')} />
            <SortableHeader label="CNPJ" className="w-40" active={sortId === 'cnpj'} direction={direction} onClick={() => requestSort('cnpj', (c) => c.cnpj ?? '', 'string')} />
            <SortableHeader label="Endereço" active={sortId === 'endereco'} direction={direction} onClick={() => requestSort('endereco', (c) => c.endereco ?? '', 'string')} />
            <th className="text-left px-4 py-2 w-24">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((client) => (
            <tr key={client.id} className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 h-12 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
              <td className="px-4 py-2 text-sm font-medium">
                <Link to={`/clientes/${client.id}`} className="text-neutral-900 dark:text-neutral-100 hover:text-brand-orange dark:hover:text-brand-orange transition-colors">
                  {client.nome}
                </Link>
              </td>
              <td className="px-4 py-2 font-mono text-sm">{client.cnpj || '—'}</td>
              <td className="px-4 py-2 max-w-xs truncate">{client.endereco || '—'}</td>
              <td className="px-4 py-2">
                <div className="flex items-center">
                  <Link
                    to={`/clientes/${client.id}`}
                    aria-label={`Ver cliente ${client.nome}`}
                    className="w-8 h-8 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-brand-orange transition-colors"
                  >
                    <Eye size={16} />
                  </Link>
                  <button
                    onClick={() => onEdit(client)}
                    aria-label={`Editar cliente ${client.nome}`}
                    className="w-8 h-8 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-brand-orange transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
