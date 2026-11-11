import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'

const router = Router()

const VALID_CONDITIONS: string[] = ['Boa', 'Com defeito', 'Danificada']
const VALID_DESTINATIONS: string[] = ['ESTOQUE', 'EM_REVISAO']

// POST / — registra devolucao e atualiza machine.status atomicamente
router.post('/', async (req, res) => {
  try {
    const { machine_id, reason, condition, destination, actor } = req.body as {
      machine_id: string
      reason: string
      condition: string
      destination: string
      actor?: string
    }

    if (!machine_id) {
      return res.status(400).json({ error: 'machine_id e obrigatorio.' })
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Motivo e obrigatorio.' })
    }

    if (!VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({ error: 'Condicao invalida. Use: Boa, Com defeito ou Danificada.' })
    }

    if (!VALID_DESTINATIONS.includes(destination)) {
      return res.status(400).json({ error: 'Destino invalido. Use: ESTOQUE ou EM_REVISAO.' })
    }

    const machine = await prisma.machine.findUnique({ where: { id: machine_id } })
    if (!machine) {
      return res.status(404).json({ error: 'Maquina nao encontrada.' })
    }

    if (machine.status !== 'ENTREGUE') {
      return res.status(400).json({ error: 'So maquinas com status ENTREGUE podem ser devolvidas.' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const returnRecord = await tx.return.create({
        data: {
          machine_id,
          reason: reason.trim(),
          condition,
          destination,
        },
      })

      // A máquina voltou para a empresa: situação comercial volta a ser ESTOQUE
      // (sai da aba Vendas/Aluguéis). Destino ESTOQUE = máquina pronta, disponível
      // para novo envio; destino EM_REVISAO = entra no fluxo de revisão.
      const newStatus = destination === 'ESTOQUE' ? 'PRONTO_ENVIO' : destination
      const updatedMachine = await tx.machine.update({
        where: { id: machine_id },
        data: { status: newStatus, type: 'ESTOQUE' },
      })

      // auditoria CREATE da devolução (aditivo, best-effort, dentro da txn)
      await logAudit(tx, {
        entity_type: 'Return',
        entity_id: returnRecord.id,
        action: 'CREATE',
        actor: actor || 'Sistema',
        summary: `Devolução registrada (destino ${destination})`,
        metadata: JSON.stringify({ machine_id, condition, destination }),
      })

      // auditoria STATUS_CHANGE da máquina (ENTREGUE -> destino)
      await logAudit(tx, {
        entity_type: 'Machine',
        entity_id: machine_id,
        action: 'STATUS_CHANGE',
        actor: actor || 'Sistema',
        summary: `Máquina devolvida — status ${newStatus}`,
        metadata: JSON.stringify({ from: 'ENTREGUE', to: newStatus }),
      })

      return { returnRecord, machine: updatedMachine }
    })

    res.status(201).json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET / — lista devolucoes com maquina e cliente incluidos
// Query param ?status=EM_REVISAO: filtra por machine.status === 'EM_REVISAO'
router.get('/', async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined

    const returns = await prisma.return.findMany({
      where: statusFilter
        ? { machine: { status: statusFilter } }
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

    res.json(returns)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /machine/:machineId — historico completo de devolucoes de uma maquina
// IMPORTANTE: declarado ANTES do handler PATCH /complete/:machineId para evitar conflito de rota
router.get('/machine/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Maquina nao encontrada.' })
    }

    const returns = await prisma.return.findMany({
      where: { machine_id: machineId },
      orderBy: { created_at: 'asc' },
      include: {
        machine: { select: { id: true, serial_number: true, product_type: true } },
      },
    })

    res.json(returns)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /complete/:machineId — conclui revisao, maquina volta pronta ao estoque (PRONTO_ENVIO)
router.patch('/complete/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params
    const { actor } = req.body

    const machine = await prisma.machine.findUnique({ where: { id: machineId } })
    if (!machine) {
      return res.status(404).json({ error: 'Maquina nao encontrada.' })
    }

    if (machine.status !== 'EM_REVISAO') {
      return res.status(400).json({ error: 'Maquina nao esta em revisao.' })
    }

    const updated = await prisma.machine.update({
      where: { id: machineId },
      data: { status: 'PRONTO_ENVIO' },
    })

    // auditoria STATUS_CHANGE (sem txn — registramos após, best-effort)
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: machineId,
      action: 'STATUS_CHANGE',
      actor: actor || 'Sistema',
      summary: 'Revisão concluída — pronta para envio (estoque)',
      metadata: JSON.stringify({ from: 'EM_REVISAO', to: 'PRONTO_ENVIO' }),
    })

    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
