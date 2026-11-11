import { PDFDocument, PDFFont, PDFForm, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { Machine, ProductType } from '../types/machine'

// Ordem de Produção / Checklist de Montagem e Inspeção Final.
// As definições de seções/itens abaixo alimentam TANTO o formulário no site
// (OrdemProducaoPage) quanto o PDF exportado — uma fonte só por produto.
// Slim ainda não tem template.

export const OP_PRODUCTS: ProductType[] = ['BOXCUBO_V2', 'EYE', 'VISION']

// Valor de cada item do checklist: OK, N/A ou não marcado
export type OpCheck = 'OK' | 'NA'

export interface OpData {
  montador?: string
  inspetor?: string
  versao_software?: string
  ip?: string
  observacoes?: string
  aprov_montador?: string
  aprov_inspetor?: string
  aprov_data?: string
  checks?: Record<string, OpCheck>
}

export interface OpSectionDef {
  key: string
  title: string // vazio = tabela extra da seção anterior
  items: string[]
  cols?: [string, string] // padrão OK / N/A
  headerLabel?: string // padrão "Item"
  redeFields?: boolean // seção Rede da V2: campos IP + MAC antes da tabela
}

const SECTIONS_V2: OpSectionDef[] = [
  { key: 'mec', title: '2. Inspeção Mecânica', items: ['Estrutura sem avarias', 'Todos os parafusos apertados', 'Tampas fixadas corretamente', 'Etiquetas aplicadas', 'Acabamento aprovado'] },
  { key: 'ele', title: '3. Inspeção Elétrica', items: ['Cabos conectados corretamente', 'Chicotes organizados', 'Conectores travados', 'Alimentação testada'] },
  { key: 'rede', title: '4. Rede', redeFields: true, items: ['IP configurado', 'MAC registrado', 'Comunicação de rede aprovada'] },
  { key: 'sens', title: '5. Sensores', items: ['Instalação conferida', 'Calibração realizada', 'Funcionamento aprovado'] },
  { key: 'bal', title: '6. Balança', items: ['Instalada corretamente', 'Aferição realizada', 'Funcionamento aprovado'] },
  { key: 'cam', title: '7. Câmera  (somente versão com câmera)', items: ['Instalação', 'Foco ajustado', 'Imagem validada', 'Comunicação aprovada'] },
  { key: 'kit', title: '8. Acessórios', items: ['Kit de Reparo incluído'], cols: ['Sim', 'Não'], headerLabel: 'Kit de Reparo' },
  { key: 'acess', title: '', items: ['Fonte', 'Cabos', 'Kit de Reparo', 'Demais acessórios'], headerLabel: 'Conferência de Itens' },
  { key: 'teste', title: '9. Teste Funcional', items: ['Inicialização do equipamento', 'Comunicação com sistema', 'Sensores funcionando', 'Balança funcionando', 'Câmera funcionando (quando aplicável)', 'Teste final aprovado'] },
  { key: 'emb', title: '10. Embalagem e Expedição', items: ['Equipamento limpo', 'Embalagem correta', 'Etiqueta de identificação', 'NF anexada'] },
]

const SECTIONS_EYE: OpSectionDef[] = [
  { key: 'mec', title: '2. Inspeção Mecânica', items: ['Estrutura sem avarias', 'Coluna fixada', 'Braço da câmera instalado', 'Manípulos instalados', 'Todos os parafusos apertados', 'Etiquetas aplicadas', 'Acabamento aprovado'] },
  { key: 'ele', title: '3. Inspeção Elétrica', items: ['Tomada de força instalada', 'Fonte instalada', 'Botão liga/desliga instalado', 'Cabos conectados corretamente', 'Cabos organizados'] },
  { key: 'rasp', title: '4. Monitor e Raspberry Pi', items: ['Monitor instalado', 'Raspberry Pi fixada', 'Cabo HDMI conectado', 'Cabo USB da câmera conectado', 'Alimentação conectada'] },
  { key: 'teste', title: '5. Teste Funcional', items: ['Equipamento inicializa corretamente', 'Monitor apresenta imagem', 'Raspberry Pi inicializa', 'Câmera funcionando', 'Botão liga/desliga funcionando', 'Teste final aprovado'] },
  { key: 'emb', title: '6. Embalagem e Expedição', items: ['Equipamento limpo', 'Embalagem correta', 'Etiqueta de identificação', 'NF anexada'] },
]

const SECTIONS_VISION: OpSectionDef[] = [
  { key: 'mec', title: '2. Inspeção Mecânica', items: ['Estrutura sem avarias', 'Faixa de LED fixada', 'Câmera fixada', 'Monitor fixado', 'Etiquetas aplicadas', 'Acabamento aprovado', 'Todos os parafusos apertados'] },
  { key: 'ele', title: '3. Inspeção Elétrica', items: ['Tomada de força instalada', 'Fonte instalada', 'Botão liga/desliga instalado', 'Cabos conectados corretamente', 'Cabos organizados'] },
  { key: 'nuc', title: '4. Monitor e NUC', items: ['Monitor instalado', 'NUC fixado', 'Cabo HDMI conectado', 'Cabo USB da câmera conectado', 'Alimentação conectada'] },
  { key: 'teste', title: '5. Teste Funcional', items: ['Equipamento inicializa corretamente', 'Monitor apresenta imagem', 'NUC inicializa', 'Câmera funcionando', 'LED funcionando', 'Botão liga/desliga funcionando', 'Teste final aprovado'] },
  { key: 'emb', title: '6. Embalagem e Expedição', items: ['Equipamento limpo', 'Embalagem correta', 'Etiqueta de identificação', 'NF anexada'] },
]

export function getOpSections(product: ProductType): OpSectionDef[] {
  if (product === 'BOXCUBO_V2') return SECTIONS_V2
  if (product === 'EYE') return SECTIONS_EYE
  if (product === 'VISION') return SECTIONS_VISION
  return []
}

// Eye e Vision têm o campo "Versão de Software" na identificação
export function hasSoftwareVersion(product: ProductType): boolean {
  return product === 'EYE' || product === 'VISION'
}

export const OP_SUBTITLES: Partial<Record<ProductType, string>> = {
  BOXCUBO_V2: 'BoxCubo V2  —  Uso interno | Setor de produção',
  EYE: 'Equipamento Eye  —  Uso interno | Setor de produção',
  VISION: 'Equipamento Vision  —  Uso interno | Setor de produção',
}

// ————————————————— PDF —————————————————

const ORANGE = rgb(0.855, 0.514, 0.004)
const GRAY_TEXT = rgb(0.13, 0.13, 0.13)
const GRAY_MID = rgb(0.45, 0.45, 0.45)
const GRAY_LIGHT = rgb(0.73, 0.73, 0.73)
const HEADER_BG = rgb(0.863, 0.902, 0.945)
const BORDER = rgb(0.8, 0.82, 0.85)

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 42
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_H = 46

interface Ctx {
  doc: PDFDocument
  form: PDFForm
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
  fieldSeq: number
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + FOOTER_H) newPage(ctx)
}

function fieldName(ctx: Ctx, prefix: string): string {
  ctx.fieldSeq += 1
  return `${prefix}_${ctx.fieldSeq}`
}

function textField(ctx: Ctx, x: number, w: number, value = '', h = 14, fontSize = 9) {
  const y = ctx.y - h
  ctx.page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.7, color: GRAY_LIGHT })
  const f = ctx.form.createTextField(fieldName(ctx, 'txt'))
  if (value) f.setText(value)
  f.addToPage(ctx.page, { x, y, width: w, height: h, borderWidth: 0 })
  f.setFontSize(fontSize)
}

function checkboxAt(ctx: Ctx, x: number, yCenter: number, checked = false, size = 10) {
  const cb = ctx.form.createCheckBox(fieldName(ctx, 'cb'))
  cb.addToPage(ctx.page, {
    x,
    y: yCenter - size / 2,
    width: size,
    height: size,
    borderWidth: 1,
    borderColor: rgb(0.3, 0.3, 0.3),
  })
  if (checked) cb.check()
}

function sectionTitle(ctx: Ctx, title: string) {
  ensure(ctx, 34)
  ctx.y -= 20
  ctx.page.drawText(title, { x: MARGIN, y: ctx.y, size: 11, font: ctx.bold, color: ORANGE })
  ctx.y -= 6
}

function labeledField(ctx: Ctx, label: string, fieldW: number, value = '', x = MARGIN, sameLine = false): number {
  if (!sameLine) {
    ensure(ctx, 20)
    ctx.y -= 18
  }
  const labelW = ctx.bold.widthOfTextAtSize(label, 9)
  ctx.page.drawText(label, { x, y: ctx.y + 3, size: 9, font: ctx.bold, color: GRAY_TEXT })
  const fx = x + labelW + 6
  const saveY = ctx.y + 14
  ctx.y = saveY
  textField(ctx, fx, fieldW, value)
  ctx.y = saveY - 14
  return fx + fieldW
}

function checkboxOption(ctx: Ctx, x: number, label: string, checked: boolean): number {
  checkboxAt(ctx, x, ctx.y + 7, checked)
  ctx.page.drawText(label, { x: x + 14, y: ctx.y + 3, size: 9, font: ctx.font, color: GRAY_TEXT })
  return x + 14 + ctx.font.widthOfTextAtSize(label, 9) + 22
}

function itemTable(ctx: Ctx, section: OpSectionDef, checks: Record<string, OpCheck>) {
  const rowH = 17
  const colW = 42
  const itemW = CONTENT_W - colW * 2
  const cols = section.cols ?? ['OK', 'N/A']
  const headerLabel = section.headerLabel ?? 'Item'

  ensure(ctx, rowH * 2)
  ctx.y -= rowH
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: CONTENT_W, height: rowH, color: HEADER_BG, borderColor: BORDER, borderWidth: 0.7 })
  ctx.page.drawText(headerLabel, { x: MARGIN + 6, y: ctx.y + 5, size: 8.5, font: ctx.bold, color: GRAY_TEXT })
  ctx.page.drawText(cols[0], { x: MARGIN + itemW + colW / 2 - ctx.bold.widthOfTextAtSize(cols[0], 8.5) / 2, y: ctx.y + 5, size: 8.5, font: ctx.bold, color: GRAY_TEXT })
  ctx.page.drawText(cols[1], { x: MARGIN + itemW + colW + colW / 2 - ctx.bold.widthOfTextAtSize(cols[1], 8.5) / 2, y: ctx.y + 5, size: 8.5, font: ctx.bold, color: GRAY_TEXT })

  section.items.forEach((item, i) => {
    const value = checks[`${section.key}_${i}`]
    ensure(ctx, rowH)
    ctx.y -= rowH
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: CONTENT_W, height: rowH, borderColor: BORDER, borderWidth: 0.7 })
    ctx.page.drawLine({ start: { x: MARGIN + itemW, y: ctx.y }, end: { x: MARGIN + itemW, y: ctx.y + rowH }, thickness: 0.7, color: BORDER })
    ctx.page.drawLine({ start: { x: MARGIN + itemW + colW, y: ctx.y }, end: { x: MARGIN + itemW + colW, y: ctx.y + rowH }, thickness: 0.7, color: BORDER })
    ctx.page.drawText(item, { x: MARGIN + 6, y: ctx.y + 5, size: 9, font: ctx.font, color: GRAY_TEXT })
    checkboxAt(ctx, MARGIN + itemW + colW / 2 - 5, ctx.y + rowH / 2, value === 'OK')
    checkboxAt(ctx, MARGIN + itemW + colW + colW / 2 - 5, ctx.y + rowH / 2, value === 'NA')
  })
}

function header(ctx: Ctx, subtitle: string) {
  const top = PAGE_H - MARGIN
  ctx.page.drawSvgPath('M 12 1 L 22 7 L 22 19 L 12 25 L 2 19 L 2 7 Z', {
    x: MARGIN,
    y: top,
    scale: 1.3,
    borderColor: ORANGE,
    borderWidth: 2,
  })
  ctx.page.drawText('BOXCUBO', { x: MARGIN + 38, y: top - 22, size: 15, font: ctx.bold, color: GRAY_MID })

  const title = 'Checklist de Montagem e Inspeção Final'
  const tw = ctx.bold.widthOfTextAtSize(title, 12.5)
  ctx.page.drawText(title, { x: PAGE_W - MARGIN - tw, y: top - 12, size: 12.5, font: ctx.bold, color: ORANGE })
  const sw = ctx.font.widthOfTextAtSize(subtitle, 9)
  ctx.page.drawText(subtitle, { x: PAGE_W - MARGIN - sw, y: top - 26, size: 9, font: ctx.font, color: GRAY_MID })

  ctx.y = top - 46
}

function footers(ctx: Ctx) {
  // Dados da empresa no rodapé: vêm do frontend/.env (VITE_EMPRESA_RODAPE, linhas separadas por "|"),
  // para não ficarem no código.
  const info = (import.meta.env.VITE_EMPRESA_RODAPE ?? '').split('|').map((l) => l.trim()).filter(Boolean)
  for (const page of ctx.doc.getPages()) {
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 26 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 26 }, thickness: 1.4, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('BOXCUBO', { x: MARGIN, y: MARGIN + 10, size: 9, font: ctx.bold, color: ORANGE })
    info.forEach((line, i) => {
      const w = ctx.font.widthOfTextAtSize(line, 5.5)
      page.drawText(line, { x: PAGE_W - MARGIN - w, y: MARGIN + 20 - i * 6.5, size: 5.5, font: ctx.font, color: GRAY_MID })
    })
  }
}

// Exporta o PDF do template com os dados salvos no site já preenchidos.
// Os campos continuam editáveis no leitor de PDF.
export async function exportOrdemProducaoPdf(machine: Machine, opData: OpData = {}) {
  if (!OP_PRODUCTS.includes(machine.product_type)) return

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: Ctx = { doc, form: doc.getForm(), page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, font, bold, fieldSeq: 0 }
  const checks = opData.checks ?? {}

  header(ctx, OP_SUBTITLES[machine.product_type] ?? '')

  // 1. Identificação
  const serial = machine.serial_number || ''
  const today = new Date().toLocaleDateString('pt-BR')
  sectionTitle(ctx, '1. Identificação')
  let endX = labeledField(ctx, 'Ordem de Produção (OP):', 150, serial ? `OP-${serial}` : '')
  labeledField(ctx, 'Data:', 90, today, endX + 24, true)
  labeledField(ctx, 'Montador:', 200, opData.montador ?? '')
  labeledField(ctx, 'Inspetor:', 200, opData.inspetor ?? '')
  endX = labeledField(ctx, 'Número de Série:', 150, serial)
  if (machine.product_type === 'BOXCUBO_V2') labeledField(ctx, 'Modelo:', 100, 'BoxCubo V2', endX + 24, true)
  if (hasSoftwareVersion(machine.product_type)) labeledField(ctx, 'Versão de Software:', 120, opData.versao_software ?? '')

  if (machine.product_type === 'BOXCUBO_V2') {
    ensure(ctx, 22)
    ctx.y -= 20
    ctx.page.drawText('Versão:', { x: MARGIN, y: ctx.y + 3, size: 9, font: ctx.bold, color: GRAY_TEXT })
    let x = MARGIN + 48
    x = checkboxOption(ctx, x, 'Com câmera', machine.camera)
    checkboxOption(ctx, x, 'Sem câmera', !machine.camera)
  }

  ensure(ctx, 22)
  ctx.y -= 20
  ctx.page.drawText('Destino:', { x: MARGIN, y: ctx.y + 3, size: 9, font: ctx.bold, color: GRAY_TEXT })
  let x = MARGIN + 48
  x = checkboxOption(ctx, x, 'Venda', machine.type === 'VENDA')
  checkboxOption(ctx, x, 'Aluguel', machine.type === 'ALUGUEL')

  // Seções do template
  for (const section of getOpSections(machine.product_type)) {
    if (section.title) sectionTitle(ctx, section.title)
    else ctx.y -= 6
    if (section.redeFields) {
      labeledField(ctx, 'Endereço IP:', 160, opData.ip ?? '')
      labeledField(ctx, 'Endereço MAC:', 160, machine.mac_address || '')
      ctx.y -= 4
    }
    itemTable(ctx, section, checks)
  }

  // Observações
  sectionTitle(ctx, 'Observações')
  ensure(ctx, 46)
  ctx.y -= 44
  const obs = ctx.form.createTextField(fieldName(ctx, 'obs'))
  obs.enableMultiline()
  if (opData.observacoes) obs.setText(opData.observacoes)
  obs.addToPage(ctx.page, { x: MARGIN, y: ctx.y, width: CONTENT_W, height: 42, borderWidth: 0.7, borderColor: GRAY_LIGHT })
  obs.setFontSize(9)

  // Aprovação
  sectionTitle(ctx, 'Aprovação')
  const rowH = 17
  const colW = CONTENT_W / 3
  // aprov_data vem do form como YYYY-MM-DD — exibe em dd/mm/aaaa
  const aprovData = opData.aprov_data && /^\d{4}-\d{2}-\d{2}$/.test(opData.aprov_data)
    ? opData.aprov_data.split('-').reverse().join('/')
    : opData.aprov_data
  const heads: [string, string | undefined][] = [
    ['Montador', opData.aprov_montador],
    ['Qualidade / Inspetor', opData.aprov_inspetor],
    ['Data', aprovData],
  ]
  ensure(ctx, rowH + 34)
  ctx.y -= rowH
  heads.forEach(([h], i) => {
    const hx = MARGIN + colW * i
    ctx.page.drawRectangle({ x: hx, y: ctx.y, width: colW, height: rowH, color: HEADER_BG, borderColor: BORDER, borderWidth: 0.7 })
    ctx.page.drawText(h, { x: hx + colW / 2 - ctx.bold.widthOfTextAtSize(h, 8.5) / 2, y: ctx.y + 5, size: 8.5, font: ctx.bold, color: GRAY_TEXT })
  })
  ctx.y -= 34
  heads.forEach(([, value], i) => {
    const hx = MARGIN + colW * i
    ctx.page.drawRectangle({ x: hx, y: ctx.y, width: colW, height: 34, borderColor: BORDER, borderWidth: 0.7 })
    const f = ctx.form.createTextField(fieldName(ctx, 'aprov'))
    if (value) f.setText(value)
    f.addToPage(ctx.page, { x: hx + 2, y: ctx.y + 2, width: colW - 4, height: 30, borderWidth: 0 })
    f.setFontSize(9)
  })

  footers(ctx)
  ctx.form.updateFieldAppearances(font)

  const bytes = await doc.save()
  const arrayBuffer = new ArrayBuffer(bytes.length)
  new Uint8Array(arrayBuffer).set(bytes)
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    const a = document.createElement('a')
    a.href = url
    a.download = `OP-${machine.serial_number || machine.product_type}.pdf`
    a.click()
  }
}
