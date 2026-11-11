import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import type { Machine, ProductType } from '../types/machine'
import { PRODUCT_LABELS } from '../types/machine'
import MachineForm from '../components/machines/MachineForm'
import type { MachineFormData } from '../components/machines/MachineForm'
import { useToast } from '../hooks/useToast'

const SLUG_TO_PRODUCT: Record<string, ProductType> = {
  'boxcubo-v2': 'BOXCUBO_V2',
  'slim': 'SLIM',
  'vision': 'VISION',
  'eye': 'EYE',
}

export default function MachineFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const { showToast, ToastComponent } = useToast()

  const [machine, setMachine] = useState<Machine | null>(null)
  const [productType, setProductType] = useState<ProductType>('BOXCUBO_V2')
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isEdit && id) {
      fetch(`/api/machines/${id}`)
        .then((r) => r.json())
        .then((data: Machine) => {
          setMachine(data)
          setProductType(data.product_type)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      const slug = searchParams.get('produto') || ''
      setProductType(SLUG_TO_PRODUCT[slug] || 'BOXCUBO_V2')
      setLoading(false)
    }
  }, [id, isEdit, searchParams])

  const title = isEdit
    ? `Editar ${PRODUCT_LABELS[productType]}`
    : `Cadastrar ${PRODUCT_LABELS[productType]}`

  const handleSubmit = async (data: MachineFormData) => {
    setSubmitting(true)
    try {
      const url = isEdit ? `/api/machines/${id}` : '/api/machines'
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit
        ? { serial_number: data.serial_number || null, mac_address: data.mac_address || null, support_plan: data.support_plan, camera: data.camera, created_by: data.created_by, client_id: data.client_id || null, type: data.type || undefined, deadline: data.deadline || null }
        : { serial_number: data.serial_number || null, product_type: productType, mac_address: data.mac_address || null, support_plan: data.support_plan, camera: data.camera, created_by: data.created_by, client_id: data.client_id || null, type: data.type || undefined, deadline: data.deadline || null }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const created = await res.json()
        if (!isEdit && data.client_id) {
          // Máquina criada já com cliente não fica em estoque: entra direto na produção (montagem)
          await fetch(`/api/production/start/${created.id}`, { method: 'POST' }).catch(() => {})
          navigate('/producao', { state: { success: true, message: 'Máquina cadastrada e enviada para produção.' } })
        } else {
          navigate('/estoque', { state: { success: true, isEdit } })
        }
      } else if (res.status === 409) {
        showToast('Este N° de série já existe.', 'error')
      } else {
        const resBody = await res.json()
        showToast(resBody.error || 'Não foi possível salvar — confira os dados.', 'error')
      }
    } catch {
      showToast('Não foi possível conectar ao servidor. Tente novamente.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {ToastComponent}
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4">
        ← Voltar
      </button>
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">{title}</h1>
      {loading ? (
        <div className="h-48 bg-white dark:bg-neutral-800 rounded-lg animate-pulse" />
      ) : (
        <MachineForm
          productType={productType}
          initialData={machine || undefined}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      )}
    </div>
  )
}
