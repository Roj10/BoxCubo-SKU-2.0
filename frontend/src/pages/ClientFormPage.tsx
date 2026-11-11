import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Client } from '../types/client'
import ClientForm from '../components/clients/ClientForm'
import { useToast } from '../hooks/useToast'

export default function ClientFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id
  const [initialData, setInitialData] = useState<Client | undefined>()
  const [dataLoading, setDataLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastComponent } = useToast()

  useEffect(() => {
    if (isEdit && id) {
      fetch(`/api/clients/${id}`)
        .then((r) => r.json())
        .then((client: Client) => {
          setInitialData(client)
          setDataLoading(false)
        })
        .catch(() => setDataLoading(false))
    }
  }, [id, isEdit])

  const handleSubmit = async (data: { nome: string; cnpj: string; endereco: string }) => {
    setSubmitting(true)
    try {
      const url = isEdit ? `/api/clients/${id}` : '/api/clients'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        navigate('/clientes', { state: { success: true } })
      } else {
        const body = await res.json()
        showToast(body.error || 'Não foi possível salvar.', 'error')
      }
    } catch {
      showToast('Não foi possível conectar ao servidor.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {ToastComponent}
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
        {isEdit ? 'Editar Cliente' : 'Cadastrar Cliente'}
      </h1>
      {dataLoading ? (
        <div className="h-48 bg-white dark:bg-neutral-800 rounded-lg animate-pulse" />
      ) : (
        <ClientForm initialData={initialData} onSubmit={handleSubmit} loading={submitting} />
      )}
    </div>
  )
}
