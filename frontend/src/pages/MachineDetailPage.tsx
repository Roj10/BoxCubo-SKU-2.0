import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QrCode, ClipboardList, ArrowLeft } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { OP_PRODUCTS } from '../lib/ordemProducao'
import type { MachineDetail } from '../types/machine'
import { PRODUCT_LABELS } from '../types/machine'
import { STAGES, STAGE_LABELS } from '../types/production'
import ProductBadge from '../components/ui/ProductBadge'
import TypeBadge from '../components/ui/TypeBadge'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import MachineTimeline from '../components/machines/MachineTimeline'
import MachineAuditSection from '../components/machines/MachineAuditSection'

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  return `${Math.max(1, minutes)}min`
}

export default function MachineDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [machine, setMachine] = useState<MachineDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setNotFound(false)
    fetch(`/api/machines/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          throw new Error('not_found')
        }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setMachine(data)
        setLoading(false)
      })
      .catch((e) => {
        if (e.message !== 'not_found') setError(true)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="h-1 bg-brand-orange animate-pulse w-full mt-2 rounded" />
  }

  if (notFound || error || !machine) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {notFound ? 'Máquina não encontrada.' : 'Não foi possível carregar a máquina.'}
        </p>
        <Button variant="ghost" onClick={() => navigate('/estoque')}>Voltar</Button>
      </div>
    )
  }

  const isV2 = machine.product_type === 'BOXCUBO_V2'

  const printLabel = () => {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const clientName = machine.client?.nome ? escapeHtml(machine.client.nome) : ''
    const url = `${window.location.origin}/maquinas/${machine.id}`
    const qr = qrcode(0, 'M')
    qr.addData(url)
    qr.make()
    const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Etiqueta ${machine.serial_number || 'sem série'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; display: flex; justify-content: center; padding: 8mm; }
  .label { width: 90mm; height: 40mm; border: 1px solid #000; border-radius: 2mm; display: flex; align-items: center; gap: 4mm; padding: 4mm; }
  .info { flex: 1; min-width: 0; }
  .brand { font-size: 8pt; font-weight: bold; letter-spacing: 1px; }
  .product { font-size: 9pt; margin-top: 1mm; }
  .serial { font-family: 'Courier New', monospace; font-size: 15pt; font-weight: bold; margin-top: 2mm; word-break: break-all; }
  .meta { font-size: 7.5pt; color: #333; margin-top: 2mm; line-height: 1.5; }
  .qr { width: 30mm; height: 30mm; flex-shrink: 0; }
  .qr svg { width: 100%; height: 100%; }
  @media print { body { padding: 0; } @page { margin: 5mm; } }
</style>
</head>
<body onload="window.print()">
  <div class="label">
    <div class="info">
      <div class="brand">BOX CUBO</div>
      <div class="product">${PRODUCT_LABELS[machine.product_type]}</div>
      <div class="serial">${machine.serial_number || 'SEM SÉRIE'}</div>
      <div class="meta">${machine.mac_address ? `MAC: ${machine.mac_address}<br/>` : ''}${clientName ? `Cliente: ${clientName}<br/>` : ''}Tipo: ${machine.type}</div>
    </div>
    <div class="qr">${svg}</div>
  </div>
</body>
</html>`
    const w = window.open('', '_blank', 'width=480,height=360')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-brand-orange transition-colors mb-3"
      >
        <ArrowLeft size={15} /> Voltar
      </button>
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <ProductBadge size="md" product={machine.product_type} />
            <p className={`text-2xl font-semibold leading-none mt-2 ${machine.serial_number ? 'text-brand-dark dark:text-neutral-100' : 'italic text-neutral-400 dark:text-neutral-500'}`}>{machine.serial_number || 'Sem série'}</p>
          </div>
          <div className="flex items-center gap-2">
            {OP_PRODUCTS.includes(machine.product_type) && (
              <Button variant="ghost" onClick={() => navigate(`/maquinas/${machine.id}/op`)}>
                <ClipboardList size={15} /> Ordem de Produção
              </Button>
            )}
            <Button variant="ghost" onClick={printLabel}>
              <QrCode size={15} /> Etiqueta
            </Button>
            <Button variant="primary" onClick={() => navigate(`/estoque/${machine.id}/editar`)}>
              Editar
            </Button>
          </div>
        </div>

        <hr className="border-neutral-200 dark:border-neutral-700 my-4" />

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Cliente</p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.client?.nome || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Tipo</p>
            <TypeBadge type={machine.type} />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Cadastrado por</p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.created_by}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Status</p>
            <StatusBadge status={machine.status} />
          </div>
          {isV2 && (
            <>
              <div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">MAC Address</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100 font-mono">{machine.mac_address || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Plano Suporte</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.support_plan ? 'Sim' : 'Não'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-0.5">Câmera</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100">{machine.camera ? 'Com câmera' : 'Sem câmera'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {machine.production_stages.length > 0 && (() => {
        // Soma a duração por etapa (todas as passagens pela produção) + total
        const sums: Record<string, number> = {}
        let inProgress: string | null = null
        let total = 0
        for (const s of machine.production_stages) {
          if (s.completed_at) {
            const ms = new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()
            sums[s.stage] = (sums[s.stage] ?? 0) + ms
            total += ms
          } else {
            inProgress = s.stage
          }
        }
        return (
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Tempos de produção</h2>
              {total > 0 && (
                <span className="text-xs font-semibold text-brand-orange">Total: {formatDuration(total)}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STAGES.map((stage) => (
                <div key={stage} className="rounded-lg border border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30 px-2 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1">{STAGE_LABELS[stage]}</p>
                  {inProgress === stage ? (
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">em andamento</p>
                  ) : sums[stage] !== undefined ? (
                    <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatDuration(sums[stage])}</p>
                  ) : (
                    <p className="text-sm text-neutral-300 dark:text-neutral-600">—</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 p-6 mt-6">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Linha do tempo</h2>
        <MachineTimeline machine={machine} />
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 p-6 mt-6">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Alterações</h2>
        <MachineAuditSection machineId={machine.id} />
      </div>
    </div>
  )
}
