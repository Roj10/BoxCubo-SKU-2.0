import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { parseUserDate } from '../lib/dates'

const router = Router()

// Fluxo simplificado: só aguardando coleta → entregue
const STATUS_ORDER: string[] = ['AGUARDANDO_COLETA', 'ENTREGUE']

// Rótulos pt-BR para exibição no CSV
const PRODUCT_LABELS_CSV: Record<string, string> = {
  BOXCUBO_V2: 'BoxCubo V2',
  SLIM: 'Slim',
  VISION: 'Vision',
  EYE: 'EYE'
}
const STATUS_LABELS_CSV: Record<string, string> = {
  AGUARDANDO_COLETA: 'Aguardando coleta',
  COLETADO: 'Coletado',
  EM_TRANSITO: 'Em trânsito',
  ENTREGUE: 'Entregue'
}

// GET / — retorna todas as entregas com máquina e cliente relacionados
// Query param ?pending=true: filtra fora as entregas com status ENTREGUE
router.get('/', async (req, res) => {
  try {
    const pending = req.query.pending === 'true'

    const deliveries = await prisma.delivery.findMany({
      where: pending
        ? { status: { not: 'ENTREGUE' } }
        : undefined,
      include: {
        machine: {
          include: {
            client: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    res.json(deliveries)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /export.csv?from=&to= — exporta as entregas do período (por created_at)
// IMPORTANTE: declarado ANTES de /machine/:machineId e dos PATCH /:id/* para evitar captura de rota
router.get('/export.csv', async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string }
    const createdAt: { gte?: Date; lte?: Date } = {}
    const fromDate = parseUserDate(from)
    if (fromDate instanceof Date) createdAt.gte = fromDate
    const toDate = to ? parseUserDate(`${to}T23:59:59`) : null
    if (toDate instanceof Date) createdAt.lte = toDate
    const where = createdAt.gte || createdAt.lte ? { created_at: createdAt } : {}

    const deliveries = await prisma.delivery.findMany({
      where,
      include: { machine: { include: { client: { select: { id: true, nome: true } } } } },
      orderBy: { created_at: 'desc' }
    })

    const header = ['N° série', 'Produto', 'Cliente', 'Transportadora', 'Status', 'Data prevista', 'Data coleta', 'Criada em']
    const escape = (v: string | number) => {
      const s = String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = deliveries.map((d) => {
      return [
        d.machine.serial_number ?? '',
        PRODUCT_LABELS_CSV[d.machine.product_type] ?? d.machine.product_type,
        d.machine.client?.nome ?? '',
        d.carrier || '',
        STATUS_LABELS_CSV[d.status] ?? d.status,
        d.expected_date ? new Date(d.expected_date).toLocaleDateString('pt-BR') : '—',
        d.pickup_date ? new Date(d.pickup_date).toLocaleDateString('pt-BR') : '—',
        new Date(d.created_at).toLocaleString('pt-BR')
      ]
        .map(escape)
        .join(';')
    })
    const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="entregas.csv"')
    res.send(csv)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST / — cria nova entrega manualmente para máquina com status PRONTO_ENVIO
router.post('/', async (req, res) => {
  try {
    const { machine_id, carrier, pickup_date, expected_date, machine_type, client_id, actor } = req.body as {
      machine_id: string
      carrier: string
      pickup_date: string | null
      expected_date?: string | null
      machine_type?: string
      client_id?: string | null
      actor?: string
    }

    const machine = await prisma.machine.findUnique({ where: { id: machine_id } })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }

    if (machine.status !== 'PRONTO_ENVIO') {
      return res.status(400).json({ error: 'Máquina não está pronta para envio.' })
    }

    if (machine_type !== 'VENDA' && machine_type !== 'ALUGUEL') {
      return res.status(400).json({ error: 'Selecione se a saída é Venda ou Aluguel.' })
    }

    const existingDraft = await prisma.delivery.findFirst({
      where: { machine_id, status: 'AGUARDANDO_COLETA' },
    })
    if (existingDraft) {
      return res.status(409).json({ error: 'Já existe uma entrega aguardando coleta para esta máquina.' })
    }

    const pickupDate = parseUserDate(pickup_date)
    const expectedDate = parseUserDate(expected_date)
    if (pickupDate === 'invalid' || expectedDate === 'invalid') {
      return res.status(400).json({ error: 'Data inválida. Confira o ano.' })
    }

    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({
        data: {
          machine_id,
          carrier: carrier ?? '',
          pickup_date: pickupDate,
          expected_date: expectedDate,
          status: 'AGUARDANDO_COLETA',
        },
      })
      // Define a situação comercial da máquina (e o cliente) ao registrar o envio
      await tx.machine.update({
        where: { id: machine_id },
        data: { type: machine_type, ...(client_id ? { client_id } : {}) },
      })
      // auditoria CREATE (aditivo, best-effort, dentro da txn)
      await logAudit(tx, {
        entity_type: 'Delivery',
        entity_id: created.id,
        action: 'CREATE',
        actor: actor || 'Sistema',
        summary: `Entrega registrada (${machine_type})`,
        metadata: JSON.stringify({ machine_id, machine_type, carrier: carrier ?? '' }),
      })
      return created
    })

    res.status(201).json(delivery)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /machine/:machineId — retorna histórico completo de entregas de uma máquina
// IMPORTANTE: declarado ANTES dos handlers PATCH /:id/* para evitar conflito de rota
router.get('/machine/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }

    const deliveries = await prisma.delivery.findMany({
      where: { machine_id: machineId },
      orderBy: { created_at: 'asc' },
    })

    res.json(deliveries)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id/register — atualiza transportadora e data de coleta do rascunho
router.patch('/:id/register', async (req, res) => {
  try {
    const { id } = req.params
    const { carrier, pickup_date, expected_date, machine_type, client_id, actor } = req.body as {
      carrier: string
      pickup_date: string
      expected_date?: string | null
      machine_type?: string
      client_id?: string | null
      actor?: string
    }

    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return res.status(404).json({ error: 'Entrega não encontrada.' })
    }

    if (delivery.status !== 'AGUARDANDO_COLETA') {
      return res.status(400).json({ error: 'Entrega já foi coletada.' })
    }

    if (!carrier || !pickup_date) {
      return res.status(400).json({ error: 'Transportadora e data de coleta são obrigatórios.' })
    }

    if (machine_type !== 'VENDA' && machine_type !== 'ALUGUEL') {
      return res.status(400).json({ error: 'Selecione se a saída é Venda ou Aluguel.' })
    }

    const pickupDate = parseUserDate(pickup_date)
    const expectedDate = parseUserDate(expected_date)
    if (pickupDate === 'invalid' || pickupDate === null || expectedDate === 'invalid') {
      return res.status(400).json({ error: 'Data inválida. Confira o ano.' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.delivery.update({
        where: { id },
        data: { carrier, pickup_date: pickupDate, ...(expected_date !== undefined ? { expected_date: expectedDate } : {}) },
      })
      await tx.machine.update({
        where: { id: delivery.machine_id },
        data: { type: machine_type, ...(client_id ? { client_id } : {}) },
      })
      // auditoria UPDATE (dados de coleta, aditivo, best-effort)
      await logAudit(tx, {
        entity_type: 'Delivery',
        entity_id: id,
        action: 'UPDATE',
        actor: actor || 'Sistema',
        summary: 'Dados de coleta atualizados',
        metadata: JSON.stringify({ carrier, machine_type }),
      })
      return result
    })

    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id/advance — avança status da entrega na sequência
router.patch('/:id/advance', async (req, res) => {
  try {
    const { id } = req.params
    const { actor } = req.body

    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return res.status(404).json({ error: 'Entrega não encontrada.' })
    }

    const currentIndex = STATUS_ORDER.indexOf(delivery.status)
    if (currentIndex === STATUS_ORDER.length - 1) {
      return res.status(400).json({ error: 'Entrega já foi concluída.' })
    }

    const nextStatus = STATUS_ORDER[currentIndex + 1]

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id },
        data: { status: nextStatus },
        include: { machine: true },
      })

      if (nextStatus === 'ENTREGUE') {
        await tx.machine.update({
          where: { id: delivery.machine_id },
          data: { status: 'ENTREGUE' },
        })
      }

      // auditoria STATUS_CHANGE (aditivo, best-effort, dentro da txn)
      await logAudit(tx, {
        entity_type: 'Delivery',
        entity_id: id,
        action: 'STATUS_CHANGE',
        actor: actor || 'Sistema',
        summary: `Entrega avançada para ${nextStatus}`,
        metadata: JSON.stringify({ from: delivery.status, to: nextStatus, machine_id: delivery.machine_id }),
      })

      return updated
    })

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id/rollback — recua status da entrega em 1 passo
router.patch('/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params
    const { actor } = req.body

    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return res.status(404).json({ error: 'Entrega não encontrada.' })
    }

    if (delivery.status === 'AGUARDANDO_COLETA') {
      return res.status(400).json({ error: 'Não é possível recuar da primeira etapa.' })
    }

    const currentIndex = STATUS_ORDER.indexOf(delivery.status)
    const previousStatus = STATUS_ORDER[currentIndex - 1]

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.delivery.update({
        where: { id },
        data: { status: previousStatus },
      })

      if (delivery.status === 'ENTREGUE') {
        await tx.machine.update({
          where: { id: delivery.machine_id },
          data: { status: 'PRONTO_ENVIO' },
        })
      }

      // auditoria STATUS_CHANGE (aditivo, best-effort, dentro da txn)
      await logAudit(tx, {
        entity_type: 'Delivery',
        entity_id: id,
        action: 'STATUS_CHANGE',
        actor: actor || 'Sistema',
        summary: `Entrega recuada para ${previousStatus}`,
        metadata: JSON.stringify({ from: delivery.status, to: previousStatus, machine_id: delivery.machine_id }),
      })

      return result
    })

    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
