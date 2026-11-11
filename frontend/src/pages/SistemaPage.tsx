import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Database, Download, HardDrive, ShieldCheck, Activity, Clock, Archive } from 'lucide-react'
import type { BackupInfo, SystemInfo } from '../types/system'
import Button from '../components/ui/Button'
import LoadingBar from '../components/ui/LoadingBar'
import { useToast } from '../hooks/useToast'

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function InfoCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200/70 dark:border-neutral-700/60 min-w-0">
      <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-full">
        <Icon size={13} className={`${accent} shrink-0`} /> {label}{sub ? ` · ${sub}` : ''}
      </p>
      <p className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
    </div>
  )
}

export default function SistemaPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [creating, setCreating] = useState(false)
  const { showToast, ToastComponent } = useToast()

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/backups')
      if (!res.ok) throw new Error()
      setBackups(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
    try {
      const res = await fetch('/api/system')
      if (res.ok) setInfo(await res.json())
    } catch {
      // diagnóstico é complementar: falha não derruba a página
    }
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const createBackup = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'Manual' }),
      })
      if (!res.ok) throw new Error()
      showToast('Backup criado.', 'success')
      await fetchBackups()
    } catch {
      showToast('Não foi possível criar o backup.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {ToastComponent}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Sistema</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Backup e manutenção do banco de dados</p>
        </div>
        <Button variant="primary" onClick={createBackup} disabled={creating}>
          <Database size={15} /> {creating ? 'Criando backup...' : 'Fazer backup agora'}
        </Button>
      </div>

      {info && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <InfoCard label="Banco de dados" value={formatSize(info.dbSizeBytes)} sub={`Node ${info.nodeVersion}`} icon={Database} accent="text-blue-500" />
          <InfoCard label="Servidor no ar há" value={formatUptime(info.uptimeSeconds)} icon={Clock} accent="text-emerald-600" />
          <InfoCard
            label="Registros"
            value={String(info.counts.machines + info.counts.clients + info.counts.deliveries + info.counts.returns + info.counts.materials + info.counts.productionStages)}
            sub={`${info.counts.machines} máquinas · ${info.counts.clients} clientes`}
            icon={Activity}
            accent="text-brand-500"
          />
          <InfoCard label="Eventos de auditoria" value={String(info.counts.auditLogs)} sub={`${info.backupsCount} backups guardados`} icon={Archive} accent="text-neutral-400" />
        </div>
      )}

      <div className="flex items-start gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg px-4 py-3 mb-5">
        <ShieldCheck size={20} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">Backup automático ativo</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            O sistema cria uma cópia consistente do banco de dados 1 vez por dia, automaticamente, e mantém os 14 backups mais recentes na pasta <span className="font-mono">backend/backups</span>. Você também pode criar um backup manual a qualquer momento.
          </p>
        </div>
      </div>

      {loading && <LoadingBar />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <AlertCircle size={48} className="text-red-300" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Não foi possível carregar os backups.</p>
          <Button variant="ghost" onClick={fetchBackups}>Tentar novamente</Button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center gap-2">
            <HardDrive size={16} className="text-brand-orange" />
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              Backups disponíveis <span className="font-normal text-neutral-400 dark:text-neutral-500">({backups.length})</span>
            </h2>
          </div>
          {backups.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
              Nenhum backup ainda. O primeiro será criado automaticamente, ou clique em "Fazer backup agora".
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-700/40 text-xs text-neutral-500 dark:text-neutral-400">
                    <th className="text-left px-4 py-2 font-medium">Arquivo</th>
                    <th className="text-left px-4 py-2 font-medium">Criado em</th>
                    <th className="text-right px-4 py-2 font-medium">Tamanho</th>
                    <th className="text-right px-4 py-2 font-medium w-28">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.filename} className="border-t border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-neutral-700 dark:text-neutral-300">{b.filename}</td>
                      <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">{new Date(b.created_at).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{formatSize(b.size)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <a
                          href={`/api/backups/download/${b.filename}`}
                          download
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-orange hover:underline"
                        >
                          <Download size={14} /> Baixar
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
