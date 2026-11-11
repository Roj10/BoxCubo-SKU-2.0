import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { applyStockMovement } from '../lib/stockMovements'
import { parseUserDate } from '../lib/dates'

const router = Router()

const PRODUCT_LABEL: Record<string, string> = { BOXCUBO_V2: 'BoxCubo V2', SLIM: 'Slim', VISION: 'Vision', EYE: 'EYE' }
// Referência da máquina nas movimentações de material: "BoxCubo V2 · série 0123"
const machineRef = (m: { product_type: string; serial_number: string | null }) =>
  `${PRODUCT_LABEL[m.product_type] ?? m.product_type}${m.serial_number ? ` · série ${m.serial_number}` : ' · sem série'}`

const STAGE_ORDER = ['RECEBIMENTO', 'MONTAGEM', 'FLASH_FIRMWARE', 'TESTE', 'EMBALAGEM'] as const
type Stage = typeof STAGE_ORDER[number]

// Rótulos pt-BR para exibição no CSV
const PRODUCT_LABELS_CSV: Record<string, string> = {
  BOXCUBO_V2: 'BoxCubo V2',
  SLIM: 'Slim',
  VISION: 'Vision',
  EYE: 'EYE'
}
const STAGE_LABELS_CSV: Record<string, string> = {
  RECEBIMENTO: 'Análise',
  MONTAGEM: 'Montagem',
  FLASH_FIRMWARE: 'Flash',
  TESTE: 'Teste',
  EMBALAGEM: 'Embalagem'
}

// Formata uma duração em milissegundos como string legível (ex.: '2h 15min', '45min', '30s')
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}min`
  if (minutes > 0) return `${minutes}min`
  return `${seconds}s`
}

// GET / — retorna todas as máquinas EM_PRODUCAO com sua etapa atual aberta
router.get('/', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({
      where: { status: 'EM_PRODUCAO' },
      include: {
        client: { select: { id: true, nome: true } },
        production_stages: {
          where: { completed_at: null },
          take: 1,
        },
      },
    })
    res.json(machines)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /export.csv?from=&to= — exporta as etapas de produção do período (por started_at), uma linha por etapa
// Declarado junto dos GETs no topo por clareza e segurança (evita captura por rotas parametrizadas)
router.get('/export.csv', async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string }
    const startedAt: { gte?: Date; lte?: Date } = {}
    const fromDate = parseUserDate(from)
    if (fromDate instanceof Date) startedAt.gte = fromDate
    const toDate = to ? parseUserDate(`${to}T23:59:59`) : null
    if (toDate instanceof Date) startedAt.lte = toDate
    const where = startedAt.gte || startedAt.lte ? { started_at: startedAt } : {}

    const stages = await prisma.productionStage.findMany({
      where,
      include: { machine: { select: { serial_number: true, product_type: true } } },
      orderBy: { started_at: 'asc' }
    })

    const header = ['N° série', 'Produto', 'Etapa', 'Início', 'Conclusão', 'Duração']
    const escape = (v: string | number) => {
      const s = String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = stages.map((s) => {
      const duracao = s.completed_at
        ? formatDuration(new Date(s.completed_at).getTime() - new Date(s.started_at).getTime())
        : '—'
      return [
        s.machine.serial_number ?? '',
        PRODUCT_LABELS_CSV[s.machine.product_type] ?? s.machine.product_type,
        STAGE_LABELS_CSV[s.stage] ?? s.stage,
        new Date(s.started_at).toLocaleString('pt-BR'),
        s.completed_at ? new Date(s.completed_at).toLocaleString('pt-BR') : 'Em andamento',
        duracao
      ]
        .map(escape)
        .join(';')
    })
    const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="producao.csv"')
    res.send(csv)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /start/:machineId — inicia produção de uma máquina aguardando produção
router.post('/start/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params
    const { actor } = req.body

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }

    if (machine.status !== 'AGUARDANDO_PRODUCAO') {
      return res.status(400).json({ error: 'Máquina não está aguardando produção.' })
    }

    // Receita (BOM) do produto desta máquina — materiais consumidos ao iniciar a produção
    const bomItems = await prisma.bomItem.findMany({
      where: { product_type: machine.product_type },
      include: { material: true },
    })

    const { updatedMachine, lowStock } = await prisma.$transaction(async (tx) => {
      await tx.productionStage.create({
        data: { machine_id: machineId, stage: 'RECEBIMENTO', started_at: new Date() },
      })
      const updated = await tx.machine.update({
        where: { id: machineId },
        data: { status: 'EM_PRODUCAO' },
        include: { client: { select: { id: true, nome: true } } },
      })

      // Baixa de cada material da receita (registrada em Movimentações de
      // materiais); coleta avisos de estoque <= 20%
      const low: { name: string; current: number; full: number }[] = []
      const { materials: baixados } = await applyStockMovement(tx, {
        type: 'PRODUCAO',
        actor: actor || 'Sistema',
        ref: machineRef(machine),
        note: 'Início da produção',
        changes: bomItems.map((item) => ({ material_id: item.material_id, quantity: -item.quantity })),
      })
      for (const m of baixados) {
        if (m.full_stock > 0 && m.current_stock <= m.full_stock * 0.2) {
          low.push({ name: m.name, current: m.current_stock, full: m.full_stock })
        }
      }

      // auditoria STATUS_CHANGE
      await logAudit(tx, {
        entity_type: 'Machine',
        entity_id: machineId,
        action: 'STATUS_CHANGE',
        actor: actor || 'Sistema',
        summary: 'Produção iniciada (ANÁLISE)',
        metadata: JSON.stringify({ from: 'AGUARDANDO_PRODUCAO', to: 'EM_PRODUCAO' }),
      })

      return { updatedMachine: updated, lowStock: low }
    })

    res.json({ ...updatedMachine, lowStock })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /advance/:machineId — avança a máquina para a próxima etapa de produção
router.post('/advance/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params
    const { actor } = req.body

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }

    if (machine.status !== 'EM_PRODUCAO') {
      return res.status(400).json({ error: 'Máquina não está em produção.' })
    }

    const currentStage = await prisma.productionStage.findFirst({
      where: { machine_id: machineId, completed_at: null },
      orderBy: { started_at: 'desc' },
    })

    if (!currentStage) {
      return res.status(404).json({ error: 'Nenhuma etapa aberta encontrada.' })
    }

    // Gate do Flash: máquina precisa ter N° de série antes de entrar no FLASH_FIRMWARE
    if (currentStage.stage === 'MONTAGEM' && !machine.serial_number) {
      return res.status(400).json({ error: 'SERIAL_REQUIRED', message: 'Associe um N° de série antes de avançar para o Flash.' })
    }
    // Gate do Flash: BoxCubo V2 também precisa de MAC address antes do FLASH_FIRMWARE
    if (currentStage.stage === 'MONTAGEM' && machine.product_type === 'BOXCUBO_V2' && !machine.mac_address) {
      return res.status(400).json({ error: 'MAC_REQUIRED', message: 'Informe o MAC address antes de avançar para o Flash.' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const closed = await tx.productionStage.updateMany({
        where: { id: currentStage.id, completed_at: null },
        data: { completed_at: new Date() },
      })

      if (closed.count === 0) {
        throw new Error('CONFLICT')
      }

      if (currentStage.stage === 'EMBALAGEM') {
        await tx.machine.update({
          where: { id: machineId },
          data: { status: 'PRONTO_ENVIO' },
        })
        await tx.delivery.create({
          data: {
            machine_id: machineId,
            carrier: '',
            pickup_date: null,
            status: 'AGUARDANDO_COLETA',
          },
        })
        // auditoria STATUS_CHANGE
        await logAudit(tx, {
          entity_type: 'Machine',
          entity_id: machineId,
          action: 'STATUS_CHANGE',
          actor: actor || 'Sistema',
          summary: 'Produção concluída — PRONTO_ENVIO',
          metadata: JSON.stringify({ from: 'EMBALAGEM', to: 'PRONTO_ENVIO' }),
        })
        return { status: 'PRONTO_ENVIO' }
      }

      const currentIndex = STAGE_ORDER.indexOf(currentStage.stage as Stage)
      const nextStage = STAGE_ORDER[currentIndex + 1]

      await tx.productionStage.create({
        data: {
          machine_id: machineId,
          stage: nextStage,
          started_at: new Date(),
        },
      })

      // auditoria STATUS_CHANGE
      await logAudit(tx, {
        entity_type: 'Machine',
        entity_id: machineId,
        action: 'STATUS_CHANGE',
        actor: actor || 'Sistema',
        summary: `Etapa avançada para ${nextStage}`,
        metadata: JSON.stringify({ from: currentStage.stage, to: nextStage }),
      })

      return { stage: nextStage }
    })

    res.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      return res.status(409).json({ error: 'Conflito: etapa já foi atualizada.' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /rollback/:machineId — retrocede a máquina para a etapa anterior
router.post('/rollback/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params
    const { actor } = req.body

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }

    if (machine.status !== 'EM_PRODUCAO') {
      return res.status(400).json({ error: 'Máquina não está em produção.' })
    }

    const currentStage = await prisma.productionStage.findFirst({
      where: { machine_id: machineId, completed_at: null },
      orderBy: { started_at: 'desc' },
    })

    if (!currentStage) {
      return res.status(404).json({ error: 'Nenhuma etapa aberta encontrada.' })
    }

    if (currentStage.stage === 'RECEBIMENTO') {
      return res.status(400).json({ error: 'Não é possível recuar da primeira etapa.' })
    }

    const currentIndex = STAGE_ORDER.indexOf(currentStage.stage as Stage)
    const previousStage = STAGE_ORDER[currentIndex - 1]

    await prisma.$transaction([
      prisma.productionStage.update({
        where: { id: currentStage.id },
        data: { completed_at: new Date() },
      }),
      prisma.productionStage.create({
        data: {
          machine_id: machineId,
          stage: previousStage,
          started_at: new Date(),
        },
      }),
    ])

    // auditoria STATUS_CHANGE (txn em forma de array — registramos após, best-effort)
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: machineId,
      action: 'STATUS_CHANGE',
      actor: actor || 'Sistema',
      summary: `Etapa retrocedida para ${previousStage}`,
      metadata: JSON.stringify({ from: currentStage.stage, to: previousStage }),
    })

    res.json({ stage: previousStage })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /cancel/:machineId — cancela produção e devolve a máquina para "aguardando produção"
router.post('/cancel/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }

    if (machine.status !== 'EM_PRODUCAO') {
      return res.status(400).json({ error: 'Máquina não está em produção.' })
    }

    // Receita do produto — estorna ao estoque os materiais baixados ao iniciar a produção
    const bomItems = await prisma.bomItem.findMany({ where: { product_type: machine.product_type } })

    await prisma.$transaction(async (tx) => {
      await tx.productionStage.updateMany({
        where: { machine_id: machineId, completed_at: null },
        data: { completed_at: new Date() },
      })
      await tx.machine.update({
        where: { id: machineId },
        data: { status: 'AGUARDANDO_PRODUCAO' },
      })
      await applyStockMovement(tx, {
        type: 'PRODUCAO_CANCELADA',
        actor: req.body?.actor || 'Sistema',
        ref: machineRef(machine),
        note: 'Produção cancelada: materiais devolvidos ao estoque',
        changes: bomItems.map((item) => ({ material_id: item.material_id, quantity: item.quantity })),
      })
    })

    res.json({ status: 'AGUARDANDO_PRODUCAO' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
