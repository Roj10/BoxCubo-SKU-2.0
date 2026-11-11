import { Router } from 'express'
import { prisma } from '../index'

// Limiar de máquina parada: dias com a etapa de produção aberta sem conclusão
const STUCK_THRESHOLD_DAYS = 7
const STUCK_MS = STUCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000

// Limiar de baixo estoque (mesma regra de materials.ts)
const LOW_STOCK_RATIO = 0.2

// Labels pt-BR das etapas de produção
const STAGE_LABELS: Record<string, string> = {
  RECEBIMENTO: 'Análise',
  MONTAGEM: 'Montagem',
  FLASH_FIRMWARE: 'Flash',
  TESTE: 'Teste',
  EMBALAGEM: 'Embalagem',
}

type AlertType = 'ENTREGA_ATRASADA' | 'MAQUINA_PARADA' | 'REVISAO_PENDENTE' | 'MATERIAL_BAIXO'
type AlertSeverity = 'alta' | 'media' | 'baixa'

interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  link: string
}

// Diferença em dias inteiros entre agora e uma data passada
function daysSince(date: Date, now: number): number {
  return Math.floor((now - date.getTime()) / (24 * 60 * 60 * 1000))
}

const router = Router()

// GET / — computa e agrega todos os alertas das 4 categorias sob demanda
router.get('/', async (_req, res) => {
  try {
    const now = Date.now()
    const nowDate = new Date(now)

    const [lateDeliveries, inProduction, inReview, materials] = await Promise.all([
      // ENTREGA_ATRASADA (ALERT-01)
      prisma.delivery.findMany({
        where: {
          status: { not: 'ENTREGUE' },
          expected_date: { lt: nowDate, not: null },
        },
        include: { machine: { include: { client: { select: { id: true, nome: true } } } } },
      }),
      // MAQUINA_PARADA (ALERT-02)
      prisma.machine.findMany({
        where: { status: 'EM_PRODUCAO' },
        include: { production_stages: { where: { completed_at: null }, take: 1 } },
      }),
      // REVISAO_PENDENTE (ALERT-03)
      prisma.machine.findMany({ where: { status: 'EM_REVISAO' } }),
      // MATERIAL_BAIXO (ALERT-04)
      prisma.material.findMany({ orderBy: { name: 'asc' } }),
    ])

    const alerts: Alert[] = []

    // ENTREGA_ATRASADA
    for (const d of lateDeliveries) {
      const serial = d.machine?.serial_number ?? 'N/D'
      const clientName = d.machine?.client?.nome
      const dias = d.expected_date ? daysSince(d.expected_date, now) : 0
      const cliente = clientName ? ` para ${clientName}` : ''
      alerts.push({
        id: `entrega-${d.id}`,
        type: 'ENTREGA_ATRASADA',
        severity: 'alta',
        title: 'Entrega atrasada',
        detail: `Entrega da máquina ${serial}${cliente} está atrasada há ${dias} dia(s).`,
        link: '/entregas',
      })
    }

    // MAQUINA_PARADA
    for (const m of inProduction) {
      const stage = m.production_stages[0]
      if (!stage) continue
      if (stage.started_at.getTime() > now - STUCK_MS) continue
      const dias = daysSince(stage.started_at, now)
      const stageLabel = STAGE_LABELS[stage.stage] ?? stage.stage
      alerts.push({
        id: `parada-${m.id}`,
        type: 'MAQUINA_PARADA',
        severity: 'media',
        title: 'Máquina parada na produção',
        detail: `Máquina ${m.serial_number} parada na etapa ${stageLabel} há ${dias} dia(s).`,
        link: `/maquinas/${m.id}`,
      })
    }

    // REVISAO_PENDENTE
    for (const m of inReview) {
      alerts.push({
        id: `revisao-${m.id}`,
        type: 'REVISAO_PENDENTE',
        severity: 'media',
        title: 'Revisão pendente',
        detail: `Máquina ${m.serial_number} (${m.product_type}) aguardando revisão.`,
        link: '/devolucoes',
      })
    }

    // MATERIAL_BAIXO
    for (const m of materials) {
      if (!(m.full_stock > 0 && m.current_stock <= m.full_stock * LOW_STOCK_RATIO)) continue
      const percent = Math.round((m.current_stock / m.full_stock) * 100)
      alerts.push({
        id: `material-${m.id}`,
        type: 'MATERIAL_BAIXO',
        severity: 'baixa',
        title: 'Estoque de material baixo',
        detail: `Material ${m.name} está com ${percent}% do estoque cheio.`,
        link: '/materiais',
      })
    }

    res.json({ alerts, count: alerts.length })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
