import path from 'path'
import fs from 'fs'
import { prisma } from '../index'
import { logAudit } from './audit'

const BACKUP_DIR = path.resolve(process.cwd(), 'backups')
const RETENTION = 14 // mantém os 14 backups mais recentes
const INTERVAL_MS = 24 * 60 * 60 * 1000 // 1 backup automático por dia

export interface BackupInfo {
  filename: string
  size: number
  created_at: string
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return []
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^backup-[\d_-]+\.db$/.test(f))
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename))
      return { filename, size: stat.size, created_at: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function backupFilePath(filename: string): string | null {
  if (!/^backup-[\d_-]+\.db$/.test(filename)) return null
  const full = path.join(BACKUP_DIR, filename)
  return fs.existsSync(full) ? full : null
}

function prune(): void {
  const stale = listBackups().slice(RETENTION)
  for (const b of stale) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.filename))
    } catch (error) {
      console.error('[backup] falha ao remover backup antigo', b.filename, error)
    }
  }
}

export async function runBackup(actor: string): Promise<BackupInfo> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  let filename = `backup-${timestamp()}.db`
  // VACUUM INTO falha se o destino já existir (dois backups no mesmo segundo)
  if (fs.existsSync(path.join(BACKUP_DIR, filename))) {
    filename = filename.replace(/\.db$/, `-${Math.floor(Math.random() * 1000)}.db`)
  }
  const dest = path.join(BACKUP_DIR, filename)
  // VACUUM INTO produz uma cópia consistente mesmo com o servidor em uso
  await prisma.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`)
  prune()
  const stat = fs.statSync(dest)
  const info: BackupInfo = { filename, size: stat.size, created_at: stat.mtime.toISOString() }
  await logAudit(prisma, {
    entity_type: 'Backup',
    entity_id: filename,
    action: 'CREATE',
    actor,
    summary: `Backup do banco de dados criado (${(stat.size / 1024).toFixed(0)} KB)`,
  })
  return info
}

export function startBackupScheduler(): void {
  const run = async () => {
    try {
      const latest = listBackups()[0]
      const age = latest ? Date.now() - new Date(latest.created_at).getTime() : Infinity
      if (age >= INTERVAL_MS) {
        const info = await runBackup('Sistema')
        console.log(`[backup] backup automático criado: ${info.filename}`)
      }
    } catch (error) {
      console.error('[backup] falha no backup automático', error)
    }
  }
  // roda na subida (se o último backup tem mais de 24h) e a cada hora verifica
  setTimeout(run, 5_000)
  setInterval(run, 60 * 60 * 1000)
}
