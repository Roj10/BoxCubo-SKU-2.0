import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Download } from 'lucide-react'
import { TEAM_MEMBERS, SERIAL_RULES } from '../types/machine'
import type { ProductType } from '../types/machine'
import Button from '../components/ui/Button'

interface ParsedRow {
  serial_number: string
  product_type: string
  mac_address: string
  support_plan: string
  client_nome: string
  created_by: string
}

interface ImportResult {
  created: number
  errors: { line: number; serial: string; error: string }[]
  warnings: { line: number; serial: string; warning: string }[]
}

const VALID_PRODUCTS = ['BOXCUBOV2', 'V2', 'SLIM', 'VISION', 'EYE']

const PRODUCT_FROM_COMPACT: Record<string, ProductType> = {
  BOXCUBOV2: 'BOXCUBO_V2',
  V2: 'BOXCUBO_V2',
  SLIM: 'SLIM',
  VISION: 'VISION',
  EYE: 'EYE',
}

function normalizeHeader(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

// Divide uma linha CSV respeitando aspas duplas
function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseCsv(text: string): { rows: ParsedRow[]; error: string | null } {
  const clean = text.replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { rows: [], error: 'O arquivo precisa de um cabeçalho e ao menos uma linha de dados.' }

  // Detecta separador: o que aparecer mais no cabeçalho
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = splitLine(lines[0], sep).map(normalizeHeader)

  const colIndex = (matchers: string[]): number =>
    headers.findIndex((h) => matchers.some((m) => h.includes(m)))

  const idx = {
    serial: colIndex(['seri']),
    product: colIndex(['produto', 'product']),
    mac: colIndex(['mac']),
    plan: colIndex(['plano', 'support']),
    client: colIndex(['client']),
    createdBy: colIndex(['cadastr', 'created', 'respons']),
  }
  if (idx.serial === -1 || idx.product === -1) {
    return { rows: [], error: 'Cabeçalho inválido: o arquivo precisa de colunas de N° de série e produto. Baixe o modelo para ver o formato.' }
  }

  const rows: ParsedRow[] = lines.slice(1).map((line) => {
    const cells = splitLine(line, sep)
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')
    return {
      serial_number: get(idx.serial),
      product_type: get(idx.product),
      mac_address: get(idx.mac),
      support_plan: get(idx.plan),
      client_nome: get(idx.client),
      created_by: get(idx.createdBy),
    }
  })
  return { rows, error: null }
}

// Validação prévia no navegador (o backend revalida tudo)
function rowIssue(row: ParsedRow): string | null {
  if (!row.serial_number) return 'N° série vazio'
  const compact = row.product_type.toUpperCase().replace(/[\s_-]/g, '')
  if (!VALID_PRODUCTS.includes(compact)) return 'Produto inválido'
  const rule = SERIAL_RULES[PRODUCT_FROM_COMPACT[compact]]
  if (!rule.pattern.test(row.serial_number.trim().toUpperCase())) {
    return `Série inválida — use ${rule.prefix} + 5 números (ex: ${rule.example})`
  }
  return null
}

function downloadTemplate() {
  const csv =
    '﻿serial_number;produto;mac_address;plano_suporte;cliente;cadastrado_por\r\n' +
    'BC12345;BoxCubo V2;AA:BB:CC:DD:EE:01;Sim;;Fulano\r\n' +
    'BCS12345;Slim;;;;Fulano\r\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-importacao-maquinas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportarMaquinasPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [responsavel, setResponsavel] = useState(TEAM_MEMBERS[0] ?? '')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const selectClass = 'text-sm rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange'

  const handleFile = async (file: File) => {
    setResult(null)
    setFileName(file.name)
    const text = await file.text()
    const { rows: parsed, error } = parseCsv(text)
    setParseError(error)
    setRows(parsed)
  }

  const validCount = rows.filter((r) => !rowIssue(r)).length

  const handleImport = async () => {
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/machines/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, actor: responsavel }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setParseError(body?.error ?? 'Não foi possível importar a planilha.')
        return
      }
      setResult(await res.json())
      setRows([])
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setParseError('Erro de conexão ao importar. Tente novamente.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/estoque" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-brand-orange transition-colors mb-4">
        <ArrowLeft size={15} /> Voltar para Estoque
      </Link>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Importar Máquinas</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Migre sua planilha para o sistema de uma vez (até 500 linhas)</p>
        </div>
        <Button variant="ghost" onClick={downloadTemplate}>
          <Download size={15} /> Baixar modelo CSV
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 p-5 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Arquivo CSV (separado por ; ou ,)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="block w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-brand-orange file:text-white file:text-sm file:font-semibold file:cursor-pointer hover:file:brightness-110"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Responsável pela importação</label>
            <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={selectClass}>
              {TEAM_MEMBERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-3">
          Colunas reconhecidas: <span className="font-mono">serial_number</span> (obrigatória), <span className="font-mono">produto</span> (obrigatória — BoxCubo V2, Slim, Vision ou EYE), <span className="font-mono">mac_address</span>, <span className="font-mono">plano_suporte</span> (sim/não), <span className="font-mono">cliente</span> (vincula pelo nome se já existir) e <span className="font-mono">cadastrado_por</span>. Todas as máquinas entram aguardando produção.
        </p>
      </div>

      {parseError && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 mb-5">
          <XCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
        </div>
      )}

      {rows.length > 0 && !parseError && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 mb-5">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-brand-orange" />
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {fileName} <span className="font-normal text-neutral-400 dark:text-neutral-500">— {rows.length} linha(s), {validCount} válida(s)</span>
              </h2>
            </div>
            <Button variant="primary" onClick={handleImport} disabled={importing || validCount === 0} loading={importing}>
              <Upload size={15} /> Importar {validCount} máquina(s)
            </Button>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/40 text-xs text-neutral-500 dark:text-neutral-400 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-10">#</th>
                  <th className="text-left px-3 py-2 font-medium">N° Série</th>
                  <th className="text-left px-3 py-2 font-medium">Produto</th>
                  <th className="text-left px-3 py-2 font-medium">MAC</th>
                  <th className="text-left px-3 py-2 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium">Cadastrado por</th>
                  <th className="text-left px-3 py-2 font-medium">Validação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const issue = rowIssue(r)
                  return (
                    <tr key={i} className={`border-t border-neutral-100 dark:border-neutral-700 ${issue ? 'bg-red-50/60 dark:bg-red-500/5' : ''}`}>
                      <td className="px-3 py-2 text-neutral-400 dark:text-neutral-500 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-neutral-800 dark:text-neutral-200">{r.serial_number || '—'}</td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{r.product_type || '—'}</td>
                      <td className="px-3 py-2 font-mono text-neutral-500 dark:text-neutral-400">{r.mac_address || '—'}</td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{r.client_nome || '—'}</td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{r.created_by || responsavel}</td>
                      <td className="px-3 py-2">
                        {issue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                            <XCircle size={13} /> {issue}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <CheckCircle2 size={13} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg px-4 py-3">
            <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              {result.created} máquina(s) importada(s).
            </p>
            <Button variant="ghost" className="ml-auto" onClick={() => navigate('/estoque')}>Ver estoque</Button>
          </div>
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-1">
                <AlertTriangle size={15} /> {result.warnings.length} aviso(s)
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i}>Linha {w.line} ({w.serial}): {w.warning}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 mb-1">
                <XCircle size={15} /> {result.errors.length} linha(s) não importada(s)
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>Linha {e.line} ({e.serial || 'sem série'}): {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
