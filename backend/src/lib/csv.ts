// CSV no padrão do sistema: separador ";", BOM UTF-8 e vírgula decimal,
// para abrir direto no Excel em português.
export const csvNum = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n * 1000) / 1000).replace('.', ','))
export const csvMoney = (n: number | null | undefined) => (n == null ? '' : n.toFixed(2).replace('.', ','))

export function buildCsv(header: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [header, ...rows].map((r) => r.map(escape).join(';')).join('\r\n')
}

export function sendCsv(res: { setHeader: (k: string, v: string) => void; send: (b: string) => void }, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
}

// "1001 Parafusos" -> "1001-parafusos" (nome de arquivo)
export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'lista'
