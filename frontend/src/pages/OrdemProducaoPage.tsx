import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileDown, Save } from 'lucide-react'
import type { Machine } from '../types/machine'
import {
  OP_PRODUCTS, OP_SUBTITLES, getOpSections, hasSoftwareVersion,
  exportOrdemProducaoPdf,
} from '../lib/ordemProducao'
import type { OpData, OpCheck, OpSectionDef } from '../lib/ordemProducao'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

const inputClass = 'w-full h-9 px-3 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange'

// Botões OK / N/A de um item do checklist — clicar de novo desmarca
function CheckPair({ value, cols, onChange }: { value?: OpCheck; cols: [string, string]; onChange: (v?: OpCheck) => void }) {
  const opt = (v: OpCheck, label: string, activeCls: string) => (
    <button
      type="button"
      onClick={() => onChange(value === v ? undefined : v)}
      className={`w-12 h-7 rounded text-xs font-medium border transition-colors ${
        value === v
          ? activeCls
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-500'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex gap-1.5 shrink-0">
      {opt('OK', cols[0], 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500')}
      {opt('NA', cols[1], 'border-neutral-500 bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200')}
    </div>
  )
}

function SectionBlock({ section, checks, onCheck }: { section: OpSectionDef; checks: Record<string, OpCheck>; onCheck: (key: string, v?: OpCheck) => void }) {
  const cols = section.cols ?? ['OK', 'N/A']
  return (
    <div>
      <div className="flex justify-between items-baseline px-4 pt-2 pb-1">
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{section.headerLabel ?? 'Item'}</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 pr-1">{cols[0]} / {cols[1]}</p>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
        {section.items.map((item, i) => {
          const key = `${section.key}_${i}`
          return (
            <div key={key} className="flex items-center justify-between gap-3 px-4 py-1.5">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">{item}</p>
              <CheckPair value={checks[key]} cols={cols} onChange={(v) => onCheck(key, v)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OrdemProducaoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast, ToastComponent } = useToast()

  const [machine, setMachine] = useState<Machine | null>(null)
  const [data, setData] = useState<OpData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/machines/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/machines/${id}/op`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, op]) => {
        setMachine(m)
        if (op) {
          setData(op.data ?? {})
          setSavedAt(op.updated_at)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const setField = useCallback(<K extends keyof OpData>(key: K, value: OpData[K]) => {
    setData((d) => ({ ...d, [key]: value }))
  }, [])

  const setCheck = useCallback((key: string, v?: OpCheck) => {
    setData((d) => {
      const checks = { ...(d.checks ?? {}) }
      if (v) checks[key] = v
      else delete checks[key]
      return { ...d, checks }
    })
  }, [])

  const save = async (): Promise<boolean> => {
    setSaving(true)
    try {
      const res = await fetch(`/api/machines/${id}/op`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, actor: data.montador || 'Sistema' }),
      })
      if (!res.ok) throw new Error()
      const op = await res.json()
      setSavedAt(op.updated_at)
      showToast('OP salva.', 'success')
      return true
    } catch {
      showToast('Não foi possível salvar a OP.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const exportPdf = async () => {
    if (!machine) return
    const ok = await save() // exporta sempre a versão mais recente
    if (ok) await exportOrdemProducaoPdf(machine, data)
  }

  if (loading) return <LoadingBar />
  if (!machine || !OP_PRODUCTS.includes(machine.product_type)) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {machine ? 'Este produto ainda não tem template de Ordem de Produção.' : 'Máquina não encontrada.'}
        </p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    )
  }

  const sections = getOpSections(machine.product_type)
  const serial = machine.serial_number || ''
  const checks = data.checks ?? {}
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0)
  const doneItems = Object.keys(checks).length

  return (
    <div className="max-w-3xl mx-auto">
      {ToastComponent}
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4">
        ← Voltar
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Ordem de Produção {serial && <span className="font-mono">OP-{serial}</span>}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{OP_SUBTITLES[machine.product_type]}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 tabular-nums">
            {doneItems}/{totalItems} itens conferidos
            {savedAt && ` · salva em ${new Date(savedAt).toLocaleString('pt-BR')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportPdf}>
            <FileDown size={15} /> Exportar PDF
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            <Save size={15} /> Salvar OP
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {/* 1. Identificação */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
            <h2 className="text-sm font-semibold text-brand-600 dark:text-brand-400">1. Identificação</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Montador</label>
              <input className={inputClass} value={data.montador ?? ''} onChange={(e) => setField('montador', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Inspetor</label>
              <input className={inputClass} value={data.inspetor ?? ''} onChange={(e) => setField('inspetor', e.target.value)} />
            </div>
            {hasSoftwareVersion(machine.product_type) && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Versão de Software</label>
                <input className={`${inputClass} max-w-[16ch]`} value={data.versao_software ?? ''} onChange={(e) => setField('versao_software', e.target.value)} />
              </div>
            )}
            <div className="md:col-span-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-neutral-600 dark:text-neutral-300 pt-1">
              <span>Data: <b className="tabular-nums">{new Date().toLocaleDateString('pt-BR')}</b></span>
              <span>Série: <b className="font-mono">{serial || 'sem série'}</b></span>
              {machine.product_type === 'BOXCUBO_V2' && <span>Versão: <b>{machine.camera ? 'Com câmera' : 'Sem câmera'}</b></span>}
              <span>Destino: <b>{machine.type === 'VENDA' ? 'Venda' : machine.type === 'ALUGUEL' ? 'Aluguel' : '—'}</b></span>
            </div>
          </div>
        </div>

        {/* Seções do checklist */}
        {sections.map((section, idx) => (
          <div key={section.key} className={section.title ? 'bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60' : '-mt-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60'}>
            {section.title && (
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
                <h2 className="text-sm font-semibold text-brand-600 dark:text-brand-400">{section.title}</h2>
              </div>
            )}
            {section.redeFields && (
              <div className="px-4 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Endereço IP</label>
                  <input className={`${inputClass} max-w-[20ch]`} value={data.ip ?? ''} onChange={(e) => setField('ip', e.target.value)} placeholder="192.168.0.10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Endereço MAC</label>
                  <p className="h-9 flex items-center text-sm font-mono text-neutral-700 dark:text-neutral-300">{machine.mac_address || '—'}</p>
                </div>
              </div>
            )}
            <div className="pb-2">
              <SectionBlock section={section} checks={checks} onCheck={setCheck} />
            </div>
            {idx === sections.length - 1 && null}
          </div>
        ))}

        {/* Observações */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
            <h2 className="text-sm font-semibold text-brand-600 dark:text-brand-400">Observações</h2>
          </div>
          <div className="p-4">
            <textarea
              rows={3}
              className="w-full border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
              value={data.observacoes ?? ''}
              onChange={(e) => setField('observacoes', e.target.value)}
            />
          </div>
        </div>

        {/* Aprovação */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
            <h2 className="text-sm font-semibold text-brand-600 dark:text-brand-400">Aprovação</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Montador</label>
              <input className={inputClass} value={data.aprov_montador ?? ''} onChange={(e) => setField('aprov_montador', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Qualidade / Inspetor</label>
              <input className={inputClass} value={data.aprov_inspetor ?? ''} onChange={(e) => setField('aprov_inspetor', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Data</label>
              <input type="date" className={`${inputClass} max-w-[18ch]`} value={data.aprov_data ?? ''} onChange={(e) => setField('aprov_data', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="ghost" onClick={exportPdf}>
            <FileDown size={15} /> Exportar PDF
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            <Save size={15} /> Salvar OP
          </Button>
        </div>
      </div>
    </div>
  )
}
