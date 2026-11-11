import { Router } from 'express'
import { listBackups, runBackup, backupFilePath } from '../lib/backup'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    res.json(listBackups())
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const actor = typeof req.body?.actor === 'string' && req.body.actor.trim() !== '' ? req.body.actor.trim() : 'Sistema'
    const info = await runBackup(actor)
    res.status(201).json(info)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Não foi possível criar o backup.' })
  }
})

router.get('/download/:filename', async (req, res) => {
  try {
    const full = backupFilePath(req.params.filename)
    if (!full) return res.status(404).json({ error: 'Backup não encontrado' })
    res.download(full)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
