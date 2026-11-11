import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { Machine, ProductType } from '../../types/machine'
import { TEAM_MEMBERS, SERIAL_RULES, PRODUCT_LABELS } from '../../types/machine'
import type { Client } from '../../types/client'
import Button from '../ui/Button'

export interface MachineFormData {
  serial_number: string
  mac_address: string
  support_plan: boolean
  camera: boolean
  created_by: string
  client_id: string
  type: string // VENDA | ALUGUEL quando tem cliente; '' sem cliente (vira ESTOQUE)
  deadline: string // 'YYYY-MM-DD' ou '' sem prazo
}

interface MachineFormProps {
  productType: ProductType
  initialData?: Machine
  onSubmit: (data: MachineFormData) => Promise<void>
  loading: boolean
}

export default function MachineForm({ productType, initialData, onSubmit, loading }: MachineFormProps) {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [serial_number, setSerialNumber] = useState(initialData?.serial_number || '')
  const [mac_address, setMacAddress] = useState(initialData?.mac_address || '')
  const [support_plan, setSupportPlan] = useState(initialData?.support_plan ?? false)
  const [camera, setCamera] = useState(initialData?.camera ?? false)
  const [created_by, setCreatedBy] = useState(initialData?.created_by || TEAM_MEMBERS[0] || '')
  const [client_id, setClientId] = useState(initialData?.client_id || '')
  const [type, setType] = useState(
    initialData?.type === 'VENDA' || initialData?.type === 'ALUGUEL' ? initialData.type : ''
  )
  const [deadline, setDeadline] = useState(initialData?.deadline ? initialData.deadline.slice(0, 10) : '')
  const [nextSerial, setNextSerial] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((data: Client[]) => setClients(data))
      .catch(console.error)
  }, [])

  // Sugestão do próximo N° de série disponível (apenas no cadastro)
  useEffect(() => {
    if (initialData) return
    fetch(`/api/machines/next-serial?product_type=${productType}`)
      .then((r) => r.json())
      .then((d) => setNextSerial(d.serial || ''))
      .catch(() => {})
  }, [productType, initialData])

  const isV2 = productType === 'BOXCUBO_V2'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    const rule = SERIAL_RULES[productType]
    const serial = serial_number.trim().toUpperCase()
    // Série é opcional no cadastro — se preenchida, precisa seguir o formato
    if (serial && !rule.pattern.test(serial)) {
      newErrors.serial_number = `Formato inválido para ${PRODUCT_LABELS[productType]}: use ${rule.prefix} + 5 números (ex: ${rule.example}).`
    }
    if (!created_by) newErrors.created_by = 'Campo obrigatório.'
    if (client_id && type !== 'VENDA' && type !== 'ALUGUEL') {
      newErrors.type = 'Máquina com cliente precisa ser Venda ou Aluguel.'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    await onSubmit({ serial_number: serial, mac_address, support_plan, camera, created_by, client_id, type: client_id ? type : '', deadline })
  }

  const inputBase = 'w-full h-10 px-3 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-md text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange'
  const inputError = 'border-red-500 focus:ring-red-500 focus:border-red-500'

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* N° Série - full width */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">N° Série</label>
          <input
            type="text"
            value={serial_number}
            onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
            className={`${inputBase} ${errors.serial_number ? inputError : ''}`}
            placeholder={nextSerial || SERIAL_RULES[productType].example}
            maxLength={SERIAL_RULES[productType].prefix.length + 5}
          />
          {errors.serial_number && <p className="text-xs text-red-600 mt-1">{errors.serial_number}</p>}
          {!errors.serial_number && !initialData && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Opcional — será exigido antes do Flash.
              {nextSerial && !serial_number && (
                <> Próximo disponível:{' '}
                  <button type="button" onClick={() => setSerialNumber(nextSerial)} className="font-mono text-brand-orange hover:underline">
                    {nextSerial}
                  </button>
                </>
              )}
            </p>
          )}
        </div>

        {/* MAC Address - V2 only */}
        {isV2 && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">MAC Address</label>
            <input
              type="text"
              value={mac_address}
              onChange={(e) => setMacAddress(e.target.value)}
              className={`${inputBase} ${errors.mac_address ? inputError : ''}`}
              placeholder="XX:XX:XX:XX:XX:XX"
            />
            {errors.mac_address && <p className="text-xs text-red-600 mt-1">{errors.mac_address}</p>}
            {!errors.mac_address && !initialData && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Opcional — será exigido antes do Flash.</p>
            )}
          </div>
        )}

        {/* Cliente */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Cliente</label>
          <div className="relative">
            <select
              value={client_id}
              onChange={(e) => { setClientId(e.target.value); if (!e.target.value) setType('') }}
              className={`${inputBase} appearance-none pr-8`}
            >
              <option value="">Selecionar cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          </div>
        </div>

        {/* Venda ou Aluguel — obrigatório quando tem cliente (com cliente não é estoque) */}
        {client_id && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Venda ou Aluguel *</label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`${inputBase} appearance-none pr-8 ${errors.type ? inputError : ''}`}
              >
                <option value="">Selecionar</option>
                <option value="VENDA">Venda</option>
                <option value="ALUGUEL">Aluguel</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            </div>
            {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type}</p>}
          </div>
        )}

        {/* Plano Suporte - V2 only */}
        {isV2 && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Plano Suporte</label>
            <label className="flex items-center gap-2 h-10 px-3 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 rounded-md cursor-pointer select-none">
              <input
                type="checkbox"
                checked={support_plan}
                onChange={(e) => setSupportPlan(e.target.checked)}
                className="accent-brand-orange w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-neutral-900 dark:text-neutral-100">{support_plan ? 'Sim' : 'Não'}</span>
            </label>
          </div>
        )}

        {/* Câmera - V2 only */}
        {isV2 && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Câmera</label>
            <label className="flex items-center gap-2 h-10 px-3 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 rounded-md cursor-pointer select-none">
              <input
                type="checkbox"
                checked={camera}
                onChange={(e) => setCamera(e.target.checked)}
                className="accent-brand-orange w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-neutral-900 dark:text-neutral-100">{camera ? 'Com câmera' : 'Sem câmera'}</span>
            </label>
          </div>
        )}

        {/* Prazo: fabricação até a entrega */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Prazo de entrega</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            max="2100-12-31"
            className={inputBase}
          />
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Opcional — prazo da fabricação até a entrega.</p>
        </div>

        {/* Cadastrado por */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Cadastrado por *</label>
          <div className="relative">
            <select
              value={created_by}
              onChange={(e) => setCreatedBy(e.target.value)}
              className={`${inputBase} appearance-none pr-8 ${errors.created_by ? inputError : ''}`}
            >
              {TEAM_MEMBERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          </div>
          {errors.created_by && <p className="text-xs text-red-600 mt-1">{errors.created_by}</p>}
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
          ← Voltar
        </button>
        <Button variant="primary" type="submit" loading={loading}>
          {initialData ? 'Salvar Alterações' : 'Salvar Máquina'}
        </Button>
      </div>
    </form>
  )
}
