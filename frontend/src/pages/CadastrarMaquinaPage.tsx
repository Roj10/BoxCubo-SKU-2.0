import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Hammer, AlertTriangle } from 'lucide-react'
import type { ProductType } from '../types/machine'
import { PRODUCT_LABELS } from '../types/machine'
import type { Material, ManufactureResult } from '../types/material'
import { useToast } from '../hooks/useToast'
import ManufactureModal from '../components/materials/ManufactureModal'

const PRODUCTS: { value: ProductType; slug: string; description: string }[] = [
  { value: 'BOXCUBO_V2', slug: 'boxcubo-v2', description: 'Máquina BoxCubo V2' },
  { value: 'SLIM', slug: 'slim', description: 'Máquina Slim' },
  { value: 'VISION', slug: 'vision', description: 'Máquina Vision' },
  { value: 'EYE', slug: 'eye', description: 'Máquina EYE' },
]

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('pt-BR')

export default function CadastrarMaquinaPage() {
  const navigate = useNavigate()
  const { showToast, ToastComponent } = useToast()
  const [subassemblies, setSubassemblies] = useState<Material[]>([])
  const [manufacturing, setManufacturing] = useState<Material | null>(null)

  const fetchSubassemblies = useCallback(async () => {
    try {
      const res = await fetch('/api/materials')
      const all: Material[] = res.ok ? await res.json() : []
      setSubassemblies(all.filter((m) => m.manufactured))
    } catch {
      setSubassemblies([])
    }
  }, [])

  useEffect(() => { fetchSubassemblies() }, [fetchSubassemblies])

  const handleManufactured = (result: ManufactureResult) => {
    const m = result.material
    const low = result.lowStock
    showToast(
      low.length > 0
        ? `${m.name}: agora ${fmt(m.current_stock)} ${m.unit}. Estoque baixo: ${low.map((l) => l.name).join(', ')}.`
        : `${m.name}: agora ${fmt(m.current_stock)} ${m.unit}.`,
      low.length > 0 ? 'error' : 'success'
    )
    fetchSubassemblies()
  }

  return (
    <div>
      {ToastComponent}
      {manufacturing && (
        <ManufactureModal
          material={manufacturing}
          onClose={() => setManufacturing(null)}
          onSuccess={handleManufactured}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Cadastrar Máquina</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Escolha o produto para iniciar o cadastro
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PRODUCTS.map((p) => (
          <button
            key={p.value}
            onClick={() => navigate(`/estoque/novo?produto=${p.slug}`)}
            className="group flex flex-col items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 text-left transition-colors hover:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-dark text-white transition-colors group-hover:bg-brand-orange">
              <Plus size={20} />
            </span>
            <div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {PRODUCT_LABELS[p.value]}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{p.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Subconjuntos fabricados internamente (BOM multinível) */}
      <div className="mt-10 mb-4">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Fabricar subconjunto</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Monta um item intermediário (ex: Shield Rasp) e baixa só os materiais da receita dele.
          {' '}
          <Link to="/materiais" className="text-brand-orange hover:underline">Gerenciar em Materiais</Link>
        </p>
      </div>

      {subassemblies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-5 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum subconjunto cadastrado. Em Materiais, marque um item como "fabricado internamente" e monte a receita dele.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subassemblies.map((m) => (
            <button
              key={m.id}
              onClick={() => setManufacturing(m)}
              className="group flex flex-col items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 text-left transition-colors hover:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 transition-colors group-hover:bg-brand-orange group-hover:text-white">
                <Hammer size={18} />
              </span>
              <div className="min-w-0 w-full">
                <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate">{m.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                  {m.low && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                  Em estoque: {fmt(m.current_stock)} {m.unit}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
