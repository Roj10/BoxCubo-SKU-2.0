import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import clientsRouter from './routes/clients'
import machinesRouter from './routes/machines'
import searchRouter from './routes/search'
import productionRouter from './routes/production'
import deliveriesRouter from './routes/deliveries'
import returnsRouter from './routes/returns'
import dashboardRouter from './routes/dashboard'
import materialsRouter from './routes/materials'
import bomRouter from './routes/bom'
import purchasesRouter from './routes/purchases'
import auditRouter from './routes/audit'
import alertsRouter from './routes/alerts'
import backupsRouter from './routes/backups'
import systemRouter from './routes/system'
import materialMovementsRouter from './routes/materialMovements'
import replenishmentRouter from './routes/replenishment'
import suppliersRouter from './routes/suppliers'
import locationsRouter from './routes/locations'
import { startBackupScheduler } from './lib/backup'

export const prisma = new PrismaClient()

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/clients', clientsRouter)
app.use('/api/machines', machinesRouter)
app.use('/api/search', searchRouter)
app.use('/api/production', productionRouter)
app.use('/api/deliveries', deliveriesRouter)
app.use('/api/returns', returnsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/materials', materialsRouter)
app.use('/api/bom', bomRouter)
app.use('/api/purchases', purchasesRouter)
app.use('/api/audit', auditRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/backups', backupsRouter)
app.use('/api/system', systemRouter)
app.use('/api/material-movements', materialMovementsRouter)
app.use('/api/replenishment', replenishmentRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/locations', locationsRouter)

// Em produção, serve o build do frontend (copiado para ../public)
const publicDir = path.join(__dirname, '..', 'public')
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  startBackupScheduler()
})
