import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

const VALID_ENTITY_TYPES = ['Machine', 'Delivery', 'Return', 'ProductionStage', 'Material']
const VALID_ACTIONS = ['CREATE', 'UPDATE', 'STATUS_CHANGE', 'DELETE', 'MANUFACTURE']

// Rota específica ANTES da genérica (caveat de ordem de rota das CONVENTIONS).
router.get('/machine/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params
    const logs = await prisma.auditLog.findMany({
      where: { entity_type: 'Machine', entity_id: machineId },
      orderBy: { created_at: 'desc' },
    })
    res.json(logs)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { entity_type, action, entity_id, q, limit } = req.query

    // where aditivo: filtros inválidos são ignorados (endpoint tolerante).
    const where: Record<string, unknown> = {}
    if (entity_type && VALID_ENTITY_TYPES.includes(entity_type as string)) {
      where.entity_type = entity_type as string
    }
    if (action && VALID_ACTIONS.includes(action as string)) {
      where.action = action as string
    }
    if (entity_id && (entity_id as string).trim() !== '') {
      where.entity_id = (entity_id as string).trim()
    }
    if (q && (q as string).trim() !== '') {
      // SQLite não suporta mode insensitive — apenas contains.
      where.summary = { contains: (q as string).trim() }
    }

    const parsedLimit = Number(limit)
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 200

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take,
    })
    res.json(logs)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
