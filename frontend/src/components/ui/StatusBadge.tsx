import type { MachineStatus } from '../../types/machine'

// Mapa semântico fixo: uma cor = um significado, em todo o app.
// Status como dot + texto neutro — a cor carrega o significado sem gritar.
const STATUS_DOT: Record<MachineStatus, string> = {
  AGUARDANDO_PRODUCAO: 'bg-neutral-400',
  EM_PRODUCAO: 'bg-blue-500',
  PRONTO_ENVIO: 'bg-emerald-500',
  ENTREGUE: 'bg-neutral-500',
  EM_REVISAO: 'bg-amber-500',
}

const STATUS_LABELS: Record<MachineStatus, string> = {
  AGUARDANDO_PRODUCAO: 'Aguardando Produção',
  EM_PRODUCAO: 'Em Produção',
  PRONTO_ENVIO: 'Pronto p/ Envio',
  ENTREGUE: 'Entregue',
  EM_REVISAO: 'Em Revisão',
}

interface StatusBadgeProps {
  status: MachineStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const live = status === 'EM_PRODUCAO'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-neutral-600 dark:text-neutral-300">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {live && <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      </span>
      {STATUS_LABELS[status]}
    </span>
  )
}
