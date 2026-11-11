// Datas digitadas pelo usuário: o JS aceita ano com dígito a mais (ex.: 20226),
// mas o SQLite não consegue gravar e o Prisma estoura erro interno.
// Valida formato E intervalo de ano antes de usar em create/update/where.
export function parseUserDate(value: unknown): Date | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null
  const d = new Date(String(value))
  if (isNaN(d.getTime())) return 'invalid'
  const year = d.getFullYear()
  if (year < 1900 || year > 2100) return 'invalid'
  return d
}
