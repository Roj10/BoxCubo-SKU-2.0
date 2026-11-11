import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, Search } from 'lucide-react'
import type { Client } from '../types/client'
import ClientTable from '../components/clients/ClientTable'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast, ToastComponent } = useToast()

  useEffect(() => {
    if (location.state?.success) {
      showToast('Cliente salvo.', 'success')
      navigate('/clientes', { replace: true, state: null })
    }
  }, [])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error()
      setClients(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return `${c.nome} ${c.cnpj ?? ''} ${c.endereco ?? ''}`.toLowerCase().includes(q)
  })

  return (
    <div>
      {ToastComponent}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Clientes</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{clients.length} clientes cadastrados</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/clientes/novo')}>
          + Cadastrar Cliente
        </Button>
      </div>

      {!loading && !error && clients.length > 0 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou endereço..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>
      )}

      {loading && <LoadingBar />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar os clientes.</p>
          <Button variant="ghost" onClick={fetchClients}>Tentar novamente</Button>
        </div>
      )}

      {!loading && !error && clients.length > 0 && filtered.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-16">Nenhum cliente corresponde à busca.</p>
      ) : !loading && !error ? (
        <ClientTable clients={filtered} onEdit={(c) => navigate(`/clientes/${c.id}/editar`)} />
      ) : null}
    </div>
  )
}
