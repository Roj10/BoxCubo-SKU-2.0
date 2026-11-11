import { Router } from 'express'
import { prisma } from '../index'
import { parseUserDate } from '../lib/dates'

const PRODUCTS = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE'] as const
const TYPES = ['VENDA', 'ALUGUEL', 'ESTOQUE'] as const
const STAGES = ['RECEBIMENTO', 'MONTAGEM', 'FLASH_FIRMWARE', 'TESTE', 'EMBALAGEM'] as const

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  if (days > 0 && hours > 0) return `${days}d ${hours}h`
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return '< 1h'
}

const router = Router()

router.get('/', async (req, res) => {
  try {
    // DASH-01: Stock counts by product and type
    const stockRaw = await prisma.machine.groupBy({ by: ['product_type', 'type'], _count: { id: true } })
    const stock = Object.fromEntries(
      PRODUCTS.map(p => [p, Object.fromEntries(TYPES.map(t => [t, 0]))])
    ) as Record<typeof PRODUCTS[number], Record<typeof TYPES[number], number>>
    for (const row of stockRaw) {
      if (stock[row.product_type as typeof PRODUCTS[number]] !== undefined &&
          TYPES.includes(row.type as any)) {
        stock[row.product_type as typeof PRODUCTS[number]][row.type as typeof TYPES[number]] = row._count.id
      }
    }

    // DASH-02: Production by stage
    const inProduction = await prisma.machine.findMany({
      where: { status: 'EM_PRODUCAO' },
      include: { production_stages: { where: { completed_at: null }, take: 1 } }
    })
    const productionByStage: Record<string, number> = Object.fromEntries(STAGES.map(s => [s, 0]))
    for (const m of inProduction) {
      const stage = m.production_stages[0]?.stage
      if (stage && stage in productionByStage) productionByStage[stage]++
    }

    // DASH-03: Delivery counts
    const deliveryRaw = await prisma.delivery.groupBy({ by: ['status'], _count: { id: true } })
    const deliveryMap: Record<string, number> = {}
    for (const row of deliveryRaw) deliveryMap[row.status] = row._count.id
    const aguardandoColeta = deliveryMap['AGUARDANDO_COLETA'] ?? 0
    const emTransito = deliveryMap['EM_TRANSITO'] ?? 0
    const entregue = deliveryMap['ENTREGUE'] ?? 0
    const deliveries = { aguardandoColeta, emTransito, entregue, total: aguardandoColeta + emTransito + entregue }

    // DASH-04: Returns summary
    const emRevisao = await prisma.machine.count({ where: { status: 'EM_REVISAO' } })
    const totalHistorico = await prisma.return.count()
    const returns = { emRevisao, totalHistorico }

    // DASH-05: Average production time per product
    const avgTimesProduction: Record<string, string> = {}
    for (const product of PRODUCTS) {
      const embRows = await prisma.productionStage.findMany({
        where: { stage: 'EMBALAGEM', completed_at: { not: null }, machine: { product_type: product } },
        include: { machine: { include: { production_stages: { where: { stage: 'RECEBIMENTO' }, orderBy: { started_at: 'asc' }, take: 1 } } } }
      })
      const durations = embRows
        .map(emb => {
          const recebimento = emb.machine.production_stages[0]
          if (!recebimento) return null
          return emb.completed_at!.getTime() - recebimento.started_at.getTime()
        })
        .filter((d): d is number => d !== null)
      avgTimesProduction[product] = durations.length > 0 ? formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length) : '—'
    }

    // DASH-06: Average stay time per product (from RECEBIMENTO to ENTREGUE)
    const avgTimesStay: Record<string, string> = {}
    for (const product of PRODUCTS) {
      const machines = await prisma.machine.findMany({
        where: { product_type: product, status: 'ENTREGUE' },
        select: { updated_at: true, production_stages: { where: { stage: 'RECEBIMENTO' }, orderBy: { started_at: 'asc' }, take: 1, select: { started_at: true } } }
      })
      const durations = machines
        .filter(m => m.production_stages.length > 0)
        .map(m => m.updated_at.getTime() - m.production_stages[0].started_at.getTime())
      avgTimesStay[product] = durations.length > 0 ? formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length) : '—'
    }

    const avgTimes = Object.fromEntries(
      PRODUCTS.map(p => [p, { avgProduction: avgTimesProduction[p], avgStay: avgTimesStay[p] }])
    )

    // DASH-07: KPIs agregados por status de máquina
    const statusRaw = await prisma.machine.groupBy({ by: ['status'], _count: { id: true } })
    const statusMap: Record<string, number> = {}
    for (const row of statusRaw) statusMap[row.status] = row._count.id
    const typeRaw = await prisma.machine.groupBy({ by: ['type'], _count: { id: true } })
    const typeMap: Record<string, number> = {}
    for (const row of typeRaw) typeMap[row.type] = row._count.id
    const totalMachines = await prisma.machine.count()
    const kpis = {
      totalMachines,
      aguardandoProducao: statusMap['AGUARDANDO_PRODUCAO'] ?? 0,
      emProducao: statusMap['EM_PRODUCAO'] ?? 0,
      prontoEnvio: statusMap['PRONTO_ENVIO'] ?? 0,
      entregue: statusMap['ENTREGUE'] ?? 0,
      emRevisao: statusMap['EM_REVISAO'] ?? 0,
      estoque: typeMap['ESTOQUE'] ?? 0,   // situação comercial = disponível
      alugadas: typeMap['ALUGUEL'] ?? 0,
      vendidas: typeMap['VENDA'] ?? 0,
    }

    // DASH-08: Materiais com estoque <= 20% do estoque cheio
    const allMaterials = await prisma.material.findMany({ orderBy: { name: 'asc' } })
    const lowMaterials = allMaterials
      .filter(m => m.full_stock > 0 && m.current_stock <= m.full_stock * 0.2)
      .map(m => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        current: m.current_stock,
        full: m.full_stock,
        percent: m.full_stock > 0 ? Math.round((m.current_stock / m.full_stock) * 100) : 0,
      }))
    const materials = { total: allMaterials.length, lowCount: lowMaterials.length, low: lowMaterials }

    // Listas de máquinas por status da operação (série + cliente nos cards)
    const OPERATION_STATUSES = ['AGUARDANDO_PRODUCAO', 'EM_PRODUCAO', 'PRONTO_ENVIO', 'ENTREGUE', 'EM_REVISAO'] as const
    const operationRaw = await prisma.machine.findMany({
      where: { status: { in: [...OPERATION_STATUSES] } },
      select: { id: true, serial_number: true, status: true, deadline: true, client: { select: { nome: true } } },
      orderBy: { updated_at: 'desc' },
    })
    // Prazo mais urgente primeiro; sem prazo vai para o fim
    operationRaw.sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime()
      if (a.deadline) return -1
      if (b.deadline) return 1
      return 0
    })
    const operationMachines: Record<string, { id: string; serial_number: string | null; client: string | null; deadline: string | null }[]> = {
      aguardandoProducao: [], emProducao: [], prontoEnvio: [], entregue: [], emRevisao: [],
    }
    const statusKey: Record<string, string> = {
      AGUARDANDO_PRODUCAO: 'aguardandoProducao', EM_PRODUCAO: 'emProducao', PRONTO_ENVIO: 'prontoEnvio', ENTREGUE: 'entregue', EM_REVISAO: 'emRevisao',
    }
    for (const m of operationRaw) {
      const key = statusKey[m.status]
      if (key) operationMachines[key].push({ id: m.id, serial_number: m.serial_number, client: m.client?.nome ?? null, deadline: m.deadline?.toISOString() ?? null })
    }

    const payload = { stock, productionByStage, deliveries, returns, avgTimes, kpis, materials, operationMachines }
    res.json(payload)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const PRODUCT_LABELS_PT: Record<string, string> = {
  BOXCUBO_V2: 'BoxCubo V2',
  SLIM: 'Slim',
  VISION: 'Vision',
  EYE: 'EYE',
}

// Insights automáticos + capacidade de produção a partir do BOM × estoque de materiais
router.get('/insights', async (_req, res) => {
  try {
    const DAY = 24 * 60 * 60 * 1000
    const now = Date.now()

    // Capacidade: quantas unidades de cada produto dá pra montar com os materiais atuais
    const bomItems = await prisma.bomItem.findMany({ include: { material: true } })
    const capacity = PRODUCTS.map((p) => {
      const items = bomItems.filter((b) => b.product_type === p)
      if (items.length === 0) return { product: p, capacity: null as number | null, bottleneck: null as string | null }
      let cap = Infinity
      let bottleneck: string | null = null
      for (const it of items) {
        const possible = it.quantity > 0 ? Math.floor(it.material.current_stock / it.quantity) : Infinity
        if (possible < cap) {
          cap = possible
          bottleneck = it.material.name
        }
      }
      return { product: p, capacity: cap === Infinity ? null : cap, bottleneck }
    })

    type Insight = { level: 'info' | 'warn' | 'critical'; text: string; link?: string }
    const insights: Insight[] = []

    // Ritmo de produção: últimos 7 dias vs 7 dias anteriores
    const produced = await prisma.productionStage.findMany({
      where: { stage: 'EMBALAGEM', completed_at: { gte: new Date(now - 14 * DAY) } },
      select: { completed_at: true },
    })
    let cur = 0
    let prev = 0
    for (const r of produced) {
      if (!r.completed_at) continue
      if (now - r.completed_at.getTime() < 7 * DAY) cur++
      else prev++
    }
    if (prev > 0 && cur > prev) {
      const pct = Math.round(((cur - prev) / prev) * 100)
      insights.push({ level: 'info', text: `Produção acelerou ${pct}% — ${cur} máquina(s) finalizada(s) nos últimos 7 dias contra ${prev} na semana anterior.` })
    } else if (cur > 0) {
      insights.push({ level: 'info', text: `${cur} máquina(s) finalizaram a produção nos últimos 7 dias.` })
    }

    // Máquinas travadas na mesma etapa há mais de 7 dias
    const stuck = await prisma.productionStage.findMany({
      where: { completed_at: null, started_at: { lt: new Date(now - 7 * DAY) } },
      include: { machine: { select: { serial_number: true } } },
      orderBy: { started_at: 'asc' },
    })
    if (stuck.length > 0) {
      const oldest = stuck[0]
      const days = Math.floor((now - oldest.started_at.getTime()) / DAY)
      insights.push({
        level: 'critical',
        text: `${stuck.length} máquina(s) parada(s) há mais de 7 dias na mesma etapa de produção — a mais antiga é ${oldest.machine.serial_number}, há ${days} dias em ${oldest.stage}.`,
        link: '/producao',
      })
    }

    // Entregas abertas há mais de 7 dias
    const staleDeliveries = await prisma.delivery.count({
      where: { status: { not: 'ENTREGUE' }, created_at: { lt: new Date(now - 7 * DAY) } },
    })
    if (staleDeliveries > 0) {
      insights.push({ level: 'warn', text: `${staleDeliveries} entrega(s) aberta(s) há mais de 7 dias sem conclusão.`, link: '/entregas' })
    }

    // Revisões esquecidas há mais de 14 dias
    const staleReviews = await prisma.machine.count({
      where: { status: 'EM_REVISAO', updated_at: { lt: new Date(now - 14 * DAY) } },
    })
    if (staleReviews > 0) {
      insights.push({ level: 'warn', text: `${staleReviews} máquina(s) em revisão há mais de 14 dias sem movimentação.`, link: '/devolucoes' })
    }

    // Capacidade crítica de materiais
    for (const c of capacity) {
      if (c.capacity === null) continue
      const label = PRODUCT_LABELS_PT[c.product] ?? c.product
      if (c.capacity === 0) {
        insights.push({ level: 'critical', text: `Materiais insuficientes para produzir qualquer unidade de ${label} — gargalo: ${c.bottleneck}.`, link: '/materiais' })
      } else if (c.capacity <= 3) {
        insights.push({ level: 'warn', text: `Materiais para apenas ${c.capacity} unidade(s) de ${label} — gargalo: ${c.bottleneck}.`, link: '/materiais' })
      }
    }

    // Máquinas prontas aguardando envio
    const prontoEnvio = await prisma.machine.count({ where: { status: 'PRONTO_ENVIO' } })
    if (prontoEnvio > 0) {
      insights.push({ level: 'info', text: `${prontoEnvio} máquina(s) prontas para envio aguardando registro de entrega.`, link: '/entregas' })
    }

    if (insights.length === 0) {
      insights.push({ level: 'info', text: 'Nenhum ponto de atenção encontrado. Operação saudável.' })
    }

    const order = { critical: 0, warn: 1, info: 2 } as const
    insights.sort((a, b) => order[a.level] - order[b.level])

    res.json({ insights, capacity })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Relatório de fechamento de período (padrão: últimos 7 dias)
router.get('/report', async (req, res) => {
  try {
    const DAY = 24 * 60 * 60 * 1000
    const toParsed = typeof req.query.to === 'string' && req.query.to ? parseUserDate(`${req.query.to}T23:59:59`) : null
    const fromParsed = typeof req.query.from === 'string' && req.query.from ? parseUserDate(`${req.query.from}T00:00:00`) : null
    if (toParsed === 'invalid' || fromParsed === 'invalid') {
      return res.status(400).json({ error: 'Datas inválidas' })
    }
    const toParam = toParsed ?? new Date()
    const fromParam = fromParsed ?? new Date(toParam.getTime() - 7 * DAY)
    const range = { gte: fromParam, lte: toParam }

    // Máquinas que concluíram a produção no período (EMBALAGEM finalizada)
    const producedRows = await prisma.productionStage.findMany({
      where: { stage: 'EMBALAGEM', completed_at: range },
      include: { machine: { select: { id: true, serial_number: true, product_type: true } } },
      orderBy: { completed_at: 'desc' },
    })
    const produced = producedRows.map((r) => ({
      machine_id: r.machine.id,
      serial_number: r.machine.serial_number,
      product_type: r.machine.product_type,
      date: r.completed_at,
    }))

    // Entregas concluídas no período
    const deliveredRows = await prisma.delivery.findMany({
      where: { status: 'ENTREGUE', updated_at: range },
      include: { machine: { select: { id: true, serial_number: true, product_type: true, client: { select: { nome: true } } } } },
      orderBy: { updated_at: 'desc' },
    })
    const delivered = deliveredRows.map((d) => ({
      machine_id: d.machine.id,
      serial_number: d.machine.serial_number,
      product_type: d.machine.product_type,
      client: d.machine.client?.nome ?? null,
      carrier: d.carrier || null,
      date: d.updated_at,
    }))

    // Devoluções registradas no período
    const returnRows = await prisma.return.findMany({
      where: { created_at: range },
      include: { machine: { select: { id: true, serial_number: true, product_type: true } } },
      orderBy: { created_at: 'desc' },
    })
    const returns = returnRows.map((r) => ({
      machine_id: r.machine.id,
      serial_number: r.machine.serial_number,
      product_type: r.machine.product_type,
      reason: r.reason,
      destination: r.destination,
      date: r.created_at,
    }))

    // Máquinas cadastradas no período
    const newRows = await prisma.machine.findMany({
      where: { created_at: range },
      select: { id: true, serial_number: true, product_type: true, type: true, created_by: true, created_at: true },
      orderBy: { created_at: 'desc' },
    })
    const newMachines = newRows.map((m) => ({
      machine_id: m.id,
      serial_number: m.serial_number,
      product_type: m.product_type,
      type: m.type,
      created_by: m.created_by,
      date: m.created_at,
    }))

    // Produções iniciadas no período (RECEBIMENTO aberto)
    const startedCount = await prisma.productionStage.count({
      where: { stage: 'RECEBIMENTO', started_at: range },
    })

    res.json({
      from: fromParam,
      to: toParam,
      totals: {
        produced: produced.length,
        delivered: delivered.length,
        returns: returns.length,
        newMachines: newMachines.length,
        started: startedCount,
      },
      produced,
      delivered,
      returns,
      newMachines,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Tendências: produção/entregas por semana (8 semanas) + devoluções por motivo + máquinas reincidentes
router.get('/trends', async (_req, res) => {
  try {
    const WEEKS = 8
    const now = new Date()
    // segunda-feira da semana atual, 00:00 local
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const weekStarts: Date[] = []
    for (let i = WEEKS - 1; i >= 0; i--) {
      weekStarts.push(new Date(monday.getTime() - i * 7 * 24 * 60 * 60 * 1000))
    }
    const rangeStart = weekStarts[0]
    const weekIndex = (d: Date): number => {
      const idx = Math.floor((d.getTime() - rangeStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
      return idx >= 0 && idx < WEEKS ? idx : -1
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    const weeks = weekStarts.map((d) => ({
      label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      produced: 0,
      delivered: 0,
    }))

    // Produção concluída = EMBALAGEM com completed_at na janela
    const producedRows = await prisma.productionStage.findMany({
      where: { stage: 'EMBALAGEM', completed_at: { gte: rangeStart } },
      select: { completed_at: true },
    })
    for (const row of producedRows) {
      if (!row.completed_at) continue
      const idx = weekIndex(row.completed_at)
      if (idx >= 0) weeks[idx].produced++
    }

    // Entregas concluídas = status ENTREGUE, agrupadas pela última atualização
    const deliveredRows = await prisma.delivery.findMany({
      where: { status: 'ENTREGUE', updated_at: { gte: rangeStart } },
      select: { updated_at: true },
    })
    for (const row of deliveredRows) {
      const idx = weekIndex(row.updated_at)
      if (idx >= 0) weeks[idx].delivered++
    }

    // Devoluções por motivo (histórico completo, top 6)
    const reasonRaw = await prisma.return.groupBy({ by: ['reason'], _count: { id: true } })
    const returnReasons = reasonRaw
      .map((r) => ({ reason: r.reason, count: r._count.id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Máquinas reincidentes: 2+ devoluções no histórico
    const offenderRaw = await prisma.return.groupBy({ by: ['machine_id'], _count: { id: true } })
    const offenderIds = offenderRaw.filter((r) => r._count.id >= 2).map((r) => r.machine_id)
    const offenderCount = Object.fromEntries(offenderRaw.map((r) => [r.machine_id, r._count.id]))
    const offenderMachines = offenderIds.length
      ? await prisma.machine.findMany({
          where: { id: { in: offenderIds } },
          include: { client: { select: { id: true, nome: true } } },
        })
      : []
    const repeatOffenders = offenderMachines
      .map((m) => ({
        id: m.id,
        serial_number: m.serial_number,
        product_type: m.product_type,
        status: m.status,
        client: m.client,
        returns_count: offenderCount[m.id] ?? 0,
      }))
      .sort((a, b) => b.returns_count - a.returns_count)

    res.json({ weeks, returnReasons, repeatOffenders })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
