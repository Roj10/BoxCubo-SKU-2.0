import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { machines: true } } }
    })
    res.json(clients)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { nome, cnpj, endereco } = req.body
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome é obrigatório.' })
    }
    const existing = await prisma.client.findFirst({ where: { nome: nome.trim() } })
    if (existing) {
      return res.status(409).json({ error: 'Já existe um cliente com este nome.' })
    }
    const client = await prisma.client.create({
      data: { nome: nome.trim(), cnpj: cnpj || null, endereco: endereco || null }
    })
    res.status(201).json(client)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Visão 360º do cliente: máquinas, entregas, devoluções e linha do tempo
router.get('/:id/overview', async (req, res) => {
  try {
    const { id } = req.params
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        machines: {
          orderBy: { updated_at: 'desc' },
          include: {
            deliveries: { orderBy: { created_at: 'desc' } },
            returns: { orderBy: { created_at: 'desc' } },
          },
        },
      },
    })
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })

    const machines = client.machines
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let totalDeliveries = 0
    let totalReturns = 0
    for (const m of machines) {
      byType[m.type] = (byType[m.type] ?? 0) + 1
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1
      totalDeliveries += m.deliveries.length
      totalReturns += m.returns.length
    }

    type TimelineEvent = {
      kind: 'DELIVERY' | 'RETURN'
      date: Date
      machine_id: string
      serial_number: string
      description: string
    }
    const events: TimelineEvent[] = []
    for (const m of machines) {
      for (const d of m.deliveries) {
        events.push({
          kind: 'DELIVERY',
          date: d.created_at,
          machine_id: m.id,
          serial_number: m.serial_number ?? '(sem série)',
          description: `Envio registrado${d.carrier ? ` via ${d.carrier}` : ''} — situação: ${d.status}`,
        })
      }
      for (const r of m.returns) {
        events.push({
          kind: 'RETURN',
          date: r.created_at,
          machine_id: m.id,
          serial_number: m.serial_number ?? '(sem série)',
          description: `Devolução: ${r.reason} (condição: ${r.condition}, destino: ${r.destination})`,
        })
      }
    }
    events.sort((a, b) => b.date.getTime() - a.date.getTime())

    res.json({
      client: { id: client.id, nome: client.nome, cnpj: client.cnpj, endereco: client.endereco, created_at: client.created_at },
      summary: {
        totalMachines: machines.length,
        alugadas: byType['ALUGUEL'] ?? 0,
        vendidas: byType['VENDA'] ?? 0,
        emRevisao: byStatus['EM_REVISAO'] ?? 0,
        totalDeliveries,
        totalReturns,
      },
      machines: machines.map((m) => ({
        id: m.id,
        serial_number: m.serial_number,
        product_type: m.product_type,
        type: m.type,
        status: m.status,
        returns_count: m.returns.length,
        updated_at: m.updated_at,
      })),
      events: events.slice(0, 30),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
    res.json(client)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { nome, cnpj, endereco } = req.body
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome é obrigatório.' })
    }
    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }
    const client = await prisma.client.update({
      where: { id },
      data: { nome: nome.trim(), cnpj: cnpj || null, endereco: endereco || null }
    })
    res.json(client)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
