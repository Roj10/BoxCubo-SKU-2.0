import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { prisma } from '../index'
import { listBackups } from '../lib/backup'

const router = Router()

function resolveDbPath(): string | null {
  const url = process.env.DATABASE_URL ?? ''
  if (!url.startsWith('file:')) return null
  // DATABASE_URL é relativo à pasta do schema (backend/prisma)
  const candidate = path.resolve(process.cwd(), 'prisma', url.replace('file:', ''))
  return fs.existsSync(candidate) ? candidate : null
}

router.get('/', async (_req, res) => {
  try {
    const dbPath = resolveDbPath()
    const dbSize = dbPath ? fs.statSync(dbPath).size : 0

    const [machines, clients, deliveries, returns, materials, auditLogs, productionStages] = await Promise.all([
      prisma.machine.count(),
      prisma.client.count(),
      prisma.delivery.count(),
      prisma.return.count(),
      prisma.material.count(),
      prisma.auditLog.count(),
      prisma.productionStage.count(),
    ])

    res.json({
      dbSizeBytes: dbSize,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      backupsCount: listBackups().length,
      counts: { machines, clients, deliveries, returns, materials, auditLogs, productionStages },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
