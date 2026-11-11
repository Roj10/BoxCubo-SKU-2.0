import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Client } from '../../types/client'
import Button from '../ui/Button'

interface ClientFormData {
  nome: string
  cnpj: string
  endereco: string
}

interface ClientFormProps {
  initialData?: Client
  onSubmit: (data: ClientFormData) => Promise<void>
  loading: boolean
}

export default function ClientForm({ initialData, onSubmit, loading }: ClientFormProps) {
  const [nome, setNome] = useState(initialData?.nome || '')
  const [cnpj, setCnpj] = useState(initialData?.cnpj || '')
  const [endereco, setEndereco] = useState(initialData?.endereco || '')
  const [errors, setErrors] = useState<{ nome?: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { nome?: string } = {}
    if (!nome.trim()) {
      newErrors.nome = 'Campo obrigatório.'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    await onSubmit({ nome, cnpj, endereco })
  }

  const inputBase = 'w-full h-10 px-3 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-md text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange'
  const inputError = 'border-red-500 focus:ring-red-500 focus:border-red-500'

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-lg">
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${inputBase} ${errors.nome ? inputError : ''}`}
            placeholder="Nome do cliente"
          />
          {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">CNPJ</label>
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className={inputBase}
            placeholder="00.000.000/0001-00"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Endereço</label>
          <textarea
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-md text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
            rows={3}
            placeholder="Endereço completo"
          />
        </div>
      </div>
      <div className="flex justify-between items-center mt-6">
        <Link to="/clientes" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
          ← Voltar para Clientes
        </Link>
        <Button variant="primary" loading={loading} type="submit">
          {initialData ? 'Salvar Alterações' : 'Salvar Cliente'}
        </Button>
      </div>
    </form>
  )
}
