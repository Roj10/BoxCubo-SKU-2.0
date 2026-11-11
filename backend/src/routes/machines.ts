import { Router } from 'express'
import { prisma } from '../index'
import { logAudit } from '../lib/audit'
import { parseUserDate } from '../lib/dates'

const router = Router()

const VALID_PRODUCT_TYPES = ['BOXCUBO_V2', 'SLIM', 'VISION', 'EYE']

// Formato do N° de série por produto: prefixo + exatamente 5 números
const SERIAL_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  BOXCUBO_V2: { pattern: /^BC\d{5}$/, hint: 'BC + 5 números (ex: BC12345)' },
  SLIM: { pattern: /^BCS\d{5}$/, hint: 'BCS + 5 números (ex: BCS12345)' },
  VISION: { pattern: /^BCV\d{5}$/, hint: 'BCV + 5 números (ex: BCV12345)' },
  EYE: { pattern: /^BCE\d{5}$/, hint: 'BCE + 5 números (ex: BCE12345)' },
}

function serialFormatError(serial: string, product_type: string): string | null {
  const rule = SERIAL_RULES[product_type]
  if (rule && !rule.pattern.test(serial.trim().toUpperCase())) {
    return `N° série inválido para o produto: use ${rule.hint}.`
  }
  return null
}

router.get('/', async (req, res) => {
  try {
    const { product_type } = req.query
    const where = product_type && VALID_PRODUCT_TYPES.includes(product_type as string)
      ? { product_type: product_type as string }
      : {}
    const machines = await prisma.machine.findMany({
      where,
      include: { client: { select: { id: true, nome: true } } },
      orderBy: { created_at: 'desc' }
    })
    res.json(machines)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /export.csv?product_type= — exporta máquinas em CSV (declarado antes de /:id)
router.get('/export.csv', async (req, res) => {
  try {
    const { product_type } = req.query
    const where = product_type && VALID_PRODUCT_TYPES.includes(product_type as string)
      ? { product_type: product_type as string }
      : {}
    const machines = await prisma.machine.findMany({
      where,
      include: { client: { select: { nome: true } } },
      orderBy: { created_at: 'desc' },
    })
    const header = ['N° Série', 'Produto', 'Tipo', 'Status', 'MAC', 'Plano Suporte', 'Cliente', 'Cadastrado por', 'Cadastrado em']
    const escape = (v: string | number) => {
      const s = String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = machines.map((m) =>
      [
        m.serial_number ?? '',
        m.product_type,
        m.type,
        m.status,
        m.mac_address ?? '',
        m.support_plan ? 'Sim' : 'Não',
        m.client?.nome ?? '',
        m.created_by,
        m.created_at.toLocaleDateString('pt-BR'),
      ]
        .map(escape)
        .join(';')
    )
    const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="maquinas.csv"')
    res.send(csv)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /next-serial?product_type= — sugere o próximo N° de série disponível do produto
// (declarado antes de /:id para a rota genérica não capturar a URL)
router.get('/next-serial', async (req, res) => {
  try {
    const product_type = String(req.query.product_type ?? '')
    if (!VALID_PRODUCT_TYPES.includes(product_type)) {
      return res.status(400).json({ error: 'Tipo de produto inválido.' })
    }
    const rule = SERIAL_RULES[product_type]
    const machines = await prisma.machine.findMany({
      where: { product_type, serial_number: { not: null } },
      select: { serial_number: true },
    })
    let max = 0
    for (const m of machines) {
      const s = m.serial_number ?? ''
      if (rule.pattern.test(s)) {
        const n = parseInt(s.replace(/\D/g, ''), 10)
        if (n > max) max = n
      }
    }
    const prefix = product_type === 'BOXCUBO_V2' ? 'BC' : product_type === 'SLIM' ? 'BCS' : product_type === 'VISION' ? 'BCV' : 'BCE'
    res.json({ serial: `${prefix}${String(max + 1).padStart(5, '0')}` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const machine = await prisma.machine.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true } },
        production_stages: { orderBy: { started_at: 'asc' } },
        deliveries: { orderBy: { created_at: 'asc' } },
        returns: { orderBy: { created_at: 'asc' } }
      }
    })
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada.' })
    }
    res.json(machine)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { serial_number, product_type, mac_address, support_plan, camera, created_by, client_id, actor } = req.body

    if (!product_type || !VALID_PRODUCT_TYPES.includes(product_type)) {
      return res.status(400).json({ error: 'Tipo de produto inválido.' })
    }
    // N° série é opcional no cadastro (obrigatório apenas ao entrar no Flash)
    const serial = typeof serial_number === 'string' && serial_number.trim() !== '' ? serial_number.trim().toUpperCase() : null
    if (serial) {
      const serialError = serialFormatError(serial, product_type)
      if (serialError) {
        return res.status(400).json({ error: serialError })
      }
      const existing = await prisma.machine.findUnique({ where: { serial_number: serial } })
      if (existing) {
        return res.status(409).json({ error: 'N° série já cadastrado no sistema.' })
      }
    }
    if (!created_by || created_by.trim() === '') {
      return res.status(400).json({ error: 'Cadastrado por é obrigatório.' })
    }

    const hasClient = client_id && client_id.trim() !== ''
    if (hasClient) {
      const client = await prisma.client.findUnique({ where: { id: client_id } })
      if (!client) return res.status(400).json({ error: 'Cliente não encontrado.' })
    }

    // Situação comercial: com cliente já nasce VENDA ou ALUGUEL; sem cliente é ESTOQUE
    const { type } = req.body
    let machineType = 'ESTOQUE'
    if (hasClient) {
      if (type !== 'VENDA' && type !== 'ALUGUEL') {
        return res.status(400).json({ error: 'Máquina com cliente precisa ser VENDA ou ALUGUEL.' })
      }
      machineType = type
    }

    // Prazo (fabricação até a entrega) — opcional, data ISO
    const { deadline } = req.body
    const deadlineDate = parseUserDate(deadline)
    if (deadlineDate === 'invalid') {
      return res.status(400).json({ error: 'Prazo inválido. Confira o ano da data.' })
    }

    const machine = await prisma.machine.create({
      data: {
        serial_number: serial,
        product_type,
        mac_address: mac_address || null,
        support_plan: Boolean(support_plan),
        camera: Boolean(camera),
        type: machineType,
        status: 'AGUARDANDO_PRODUCAO',
        deadline: deadlineDate,
        created_by: created_by.trim(),
        client_id: client_id || null,
      },
      include: { client: { select: { id: true, nome: true } } }
    })
    // auditoria (aditivo, best-effort)
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: machine.id,
      action: 'CREATE',
      actor: actor || machine.created_by || 'Sistema',
      summary: `Máquina ${machine.serial_number ?? '(sem série)'} cadastrada`,
      metadata: JSON.stringify({ product_type: machine.product_type, type: machine.type }),
    })
    res.status(201).json(machine)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Interpreta sim/não vindo de planilha: "Sim", "S", "yes", "true", "1", "x" → true
function parseSimNao(raw: unknown): boolean {
  const v = String(raw ?? '').trim().toLowerCase()
  return ['sim', 's', 'yes', 'y', 'true', '1', 'x'].includes(v)
}

// Normaliza o nome do produto vindo de planilha: "BoxCubo V2", "boxcubo-v2", "V2" → BOXCUBO_V2
function normalizeProduct(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[\s_-]/g, '')
  if (compact === 'BOXCUBOV2' || compact === 'V2') return 'BOXCUBO_V2'
  if (compact === 'SLIM') return 'SLIM'
  if (compact === 'VISION') return 'VISION'
  if (compact === 'EYE') return 'EYE'
  return null
}

// Importação em massa a partir de planilha (CSV processado no frontend)
router.post('/import', async (req, res) => {
  try {
    const { rows, actor } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha para importar.' })
    }
    if (rows.length > 500) {
      return res.status(400).json({ error: 'Máximo de 500 linhas por importação.' })
    }
    const importActor = typeof actor === 'string' && actor.trim() !== '' ? actor.trim() : 'Importação'

    // Pré-carrega séries existentes e clientes por nome para validar sem N consultas
    const existingSerials = new Set(
      (await prisma.machine.findMany({ select: { serial_number: true } }))
        .map((m) => m.serial_number?.toLowerCase())
        .filter((s): s is string => !!s)
    )
    const clients = await prisma.client.findMany({ select: { id: true, nome: true } })
    const clientByName = new Map(clients.map((c) => [c.nome.trim().toLowerCase(), c.id]))

    const errors: { line: number; serial: string; error: string }[] = []
    const warnings: { line: number; serial: string; warning: string }[] = []
    let created = 0
    const seenInBatch = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {}
      const line = i + 1
      const serial = String(r.serial_number ?? '').trim()
      if (!serial) {
        errors.push({ line, serial: '', error: 'N° série vazio.' })
        continue
      }
      const product = normalizeProduct(String(r.product_type ?? ''))
      if (!product) {
        errors.push({ line, serial, error: `Produto inválido: "${r.product_type ?? ''}". Use BoxCubo V2, Slim, Vision ou EYE.` })
        continue
      }
      const serialError = serialFormatError(serial, product)
      if (serialError) {
        errors.push({ line, serial, error: serialError })
        continue
      }
      if (existingSerials.has(serial.toLowerCase())) {
        errors.push({ line, serial, error: 'N° série já cadastrado no sistema.' })
        continue
      }
      if (seenInBatch.has(serial.toLowerCase())) {
        errors.push({ line, serial, error: 'N° série duplicado dentro da planilha.' })
        continue
      }

      let client_id: string | null = null
      const clientName = String(r.client_nome ?? '').trim()
      if (clientName) {
        client_id = clientByName.get(clientName.toLowerCase()) ?? null
        if (!client_id) {
          warnings.push({ line, serial, warning: `Cliente "${clientName}" não encontrado — máquina importada sem vínculo.` })
        }
      }

      const createdBy = String(r.created_by ?? '').trim() || importActor

      const machine = await prisma.machine.create({
        data: {
          serial_number: serial.toUpperCase(),
          product_type: product,
          mac_address: String(r.mac_address ?? '').trim() || null,
          support_plan: parseSimNao(r.support_plan),
          type: 'ESTOQUE',
          status: 'AGUARDANDO_PRODUCAO',
          created_by: createdBy,
          client_id,
        },
      })
      await logAudit(prisma, {
        entity_type: 'Machine',
        entity_id: machine.id,
        action: 'CREATE',
        actor: importActor,
        summary: `Máquina ${machine.serial_number} cadastrada via importação de planilha`,
        metadata: JSON.stringify({ product_type: machine.product_type, import: true }),
      })
      seenInBatch.add(serial.toLowerCase())
      created++
    }

    res.status(created > 0 ? 201 : 200).json({ created, errors, warnings })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { serial_number, mac_address, support_plan, camera, created_by, client_id, actor } = req.body

    const existing = await prisma.machine.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Máquina não encontrada.' })

    // N° série é opcional (obrigatório apenas ao entrar no Flash)
    const serial = typeof serial_number === 'string' && serial_number.trim() !== '' ? serial_number.trim().toUpperCase() : null
    if (serial) {
      const serialError = serialFormatError(serial, existing.product_type)
      if (serialError) {
        return res.status(400).json({ error: serialError })
      }
      const duplicate = await prisma.machine.findFirst({
        where: { serial_number: serial, NOT: { id } }
      })
      if (duplicate) return res.status(409).json({ error: 'N° série já cadastrado no sistema.' })
    }

    const hasClient = client_id && client_id.trim() !== ''
    if (hasClient) {
      const client = await prisma.client.findUnique({ where: { id: client_id } })
      if (!client) return res.status(400).json({ error: 'Cliente não encontrado.' })
    }

    // Situação comercial coerente com o cliente: com cliente → VENDA/ALUGUEL; sem cliente → ESTOQUE
    const { type } = req.body
    let machineType = existing.type
    if (hasClient) {
      if (type === 'VENDA' || type === 'ALUGUEL') machineType = type
      else if (existing.type === 'ESTOQUE') {
        return res.status(400).json({ error: 'Máquina com cliente precisa ser VENDA ou ALUGUEL.' })
      }
    } else {
      machineType = 'ESTOQUE'
    }

    // Prazo (fabricação até a entrega) — opcional, data ISO
    const { deadline } = req.body
    const deadlineDate = parseUserDate(deadline)
    if (deadlineDate === 'invalid') {
      return res.status(400).json({ error: 'Prazo inválido. Confira o ano da data.' })
    }

    const machine = await prisma.machine.update({
      where: { id },
      data: {
        serial_number: serial,
        mac_address: mac_address || null,
        support_plan: Boolean(support_plan),
        camera: Boolean(camera),
        type: machineType,
        deadline: deadlineDate,
        created_by: created_by.trim(),
        client_id: client_id || null,
      },
      include: { client: { select: { id: true, nome: true } } }
    })
    // auditoria (aditivo, best-effort)
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: machine.id,
      action: 'UPDATE',
      actor: actor || 'Sistema',
      summary: `Máquina ${machine.serial_number ?? '(sem série)'} editada`,
      metadata: JSON.stringify({
        before: {
          serial_number: existing.serial_number,
          mac_address: existing.mac_address,
          support_plan: existing.support_plan,
          client_id: existing.client_id,
        },
      }),
    })
    res.json(machine)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /:id/op — Ordem de Produção preenchida no site (ou null se ainda não existe)
router.get('/:id/op', async (req, res) => {
  try {
    const { id } = req.params
    const op = await prisma.productionOrder.findUnique({ where: { machine_id: id } })
    if (!op) return res.json(null)
    res.json({ id: op.id, machine_id: op.machine_id, data: JSON.parse(op.data), created_at: op.created_at, updated_at: op.updated_at })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id/op — cria/atualiza a Ordem de Produção da máquina
router.put('/:id/op', async (req, res) => {
  try {
    const { id } = req.params
    const { data, actor } = req.body

    const machine = await prisma.machine.findUnique({ where: { id } })
    if (!machine) return res.status(404).json({ error: 'Máquina não encontrada.' })
    if (typeof data !== 'object' || data === null) {
      return res.status(400).json({ error: 'Dados da OP inválidos.' })
    }

    const payload = JSON.stringify(data)
    const existing = await prisma.productionOrder.findUnique({ where: { machine_id: id } })
    const op = await prisma.productionOrder.upsert({
      where: { machine_id: id },
      create: { machine_id: id, data: payload },
      update: { data: payload },
    })
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: id,
      action: 'UPDATE',
      actor: typeof actor === 'string' && actor.trim() !== '' ? actor.trim() : 'Sistema',
      summary: `OP ${existing ? 'atualizada' : 'preenchida'} — máquina ${machine.serial_number ?? '(sem série)'}`,
      metadata: JSON.stringify({ op_id: op.id }),
    })
    res.json({ id: op.id, machine_id: op.machine_id, data: JSON.parse(op.data), created_at: op.created_at, updated_at: op.updated_at })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id/serial — associa/atualiza apenas o N° de série (usado no gate do Flash)
router.patch('/:id/serial', async (req, res) => {
  try {
    const { id } = req.params
    const { serial_number, actor } = req.body

    const existing = await prisma.machine.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Máquina não encontrada.' })

    if (!serial_number || String(serial_number).trim() === '') {
      return res.status(400).json({ error: 'N° série é obrigatório.' })
    }
    const serial = String(serial_number).trim().toUpperCase()
    const serialError = serialFormatError(serial, existing.product_type)
    if (serialError) return res.status(400).json({ error: serialError })

    const duplicate = await prisma.machine.findFirst({ where: { serial_number: serial, NOT: { id } } })
    if (duplicate) return res.status(409).json({ error: 'N° série já cadastrado no sistema.' })

    const machine = await prisma.machine.update({
      where: { id },
      data: { serial_number: serial },
      include: { client: { select: { id: true, nome: true } } },
    })
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: machine.id,
      action: 'UPDATE',
      actor: typeof actor === 'string' && actor.trim() !== '' ? actor.trim() : 'Sistema',
      summary: `N° de série ${serial} associado à máquina`,
      metadata: JSON.stringify({ before: existing.serial_number, after: serial }),
    })
    res.json(machine)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /:id/mac — associa/atualiza apenas o MAC address (usado no gate do Flash para V2)
router.patch('/:id/mac', async (req, res) => {
  try {
    const { id } = req.params
    const { mac_address, actor } = req.body

    const existing = await prisma.machine.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Máquina não encontrada.' })

    if (!mac_address || String(mac_address).trim() === '') {
      return res.status(400).json({ error: 'MAC address é obrigatório.' })
    }
    const mac = String(mac_address).trim()

    const machine = await prisma.machine.update({
      where: { id },
      data: { mac_address: mac },
      include: { client: { select: { id: true, nome: true } } },
    })
    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: machine.id,
      action: 'UPDATE',
      actor: typeof actor === 'string' && actor.trim() !== '' ? actor.trim() : 'Sistema',
      summary: `MAC address ${mac} associado à máquina`,
      metadata: JSON.stringify({ before: existing.mac_address, after: mac }),
    })
    res.json(machine)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const actor = typeof req.query.actor === 'string' && req.query.actor.trim() !== '' ? req.query.actor.trim() : 'Sistema'

    const machine = await prisma.machine.findUnique({ where: { id } })
    if (!machine) return res.status(404).json({ error: 'Máquina não encontrada.' })

    // Remove registros relacionados na mesma transação (schema sem cascade)
    await prisma.$transaction([
      prisma.productionStage.deleteMany({ where: { machine_id: id } }),
      prisma.delivery.deleteMany({ where: { machine_id: id } }),
      prisma.return.deleteMany({ where: { machine_id: id } }),
      prisma.machine.delete({ where: { id } }),
    ])

    await logAudit(prisma, {
      entity_type: 'Machine',
      entity_id: id,
      action: 'DELETE',
      actor,
      summary: `Máquina ${machine.serial_number ?? '(sem série)'} excluída`,
      metadata: JSON.stringify({ product_type: machine.product_type, status: machine.status, type: machine.type }),
    })
    res.json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
