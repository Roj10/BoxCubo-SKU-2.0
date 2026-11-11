import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const q = req.query.q as string
    if (!q || q.trim().length < 2) {
      return res.json({ machines: [], clients: [] })
    }
    const term = q.trim()
    // SQLite LIKE é case-insensitive para ASCII por padrão, então `contains`
    // (que vira LIKE) já cobre buscas com caixa trocada. O provider sqlite
    // do Prisma NÃO suporta `mode: 'insensitive'`, por isso não o usamos.
    const machines = await prisma.machine.findMany({
      where: {
        OR: [
          { serial_number: { contains: term } },
          { mac_address: { contains: term } },
          { client: { is: { nome: { contains: term } } } },
        ]
      },
      include: { client: { select: { id: true, nome: true } } },
      take: 8,
      orderBy: { serial_number: 'asc' }
    })
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { nome: { contains: term } },
          { cnpj: { contains: term } },
        ]
      },
      select: { id: true, nome: true, cnpj: true },
      take: 8,
      orderBy: { nome: 'asc' }
    })
    res.json({ machines, clients })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
