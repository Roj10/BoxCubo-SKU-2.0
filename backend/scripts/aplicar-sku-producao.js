// ============================================================
//  APLICAR SKU NOS MATERIAIS DA PRODUÇÃO (Raspberry)
// ============================================================
//  Só PREENCHE o campo SKU dos materiais que já existem no banco.
//  NÃO cria, NÃO apaga e NÃO muda nome, estoque, receita ou preço de nenhum
//  material. Material que já tem SKU fica como está.
//
//  Lê scripts/sku-producao.json: [{ id, name, sku }] montado a partir da
//  lista de materiais do Raspberry (11/11/2026). Acha o material pelo id
//  e, se não achar, pelo nome exato.
//
//  Como usar (na pasta do app, onde estão node_modules e prisma/):
//    node scripts/aplicar-sku-producao.js --simular   mostra o que faria
//    node scripts/aplicar-sku-producao.js             grava
//
//  Pode rodar de novo: o que já tem SKU é pulado.

const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

const SIMULAR = process.argv.includes('--simular')
const lista = JSON.parse(fs.readFileSync(path.join(__dirname, 'sku-producao.json'), 'utf8'))

async function main() {
  const prisma = new PrismaClient()
  try {
    const todos = await prisma.material.findMany({ select: { id: true, name: true, sku: true } })
    const antes = todos.length
    const porId = new Map(todos.map((m) => [m.id, m]))
    const porNome = new Map()
    for (const m of todos) porNome.set(m.name, porNome.has(m.name) ? 'VARIOS' : m)
    const usados = new Set(todos.filter((m) => m.sku).map((m) => m.sku))

    const aplicar = []
    const pulados = []
    for (const item of lista) {
      let m = porId.get(item.id)
      if (!m) {
        const n = porNome.get(item.name)
        if (n === 'VARIOS') { pulados.push(`${item.name}: mais de um material com esse nome`); continue }
        m = n
      }
      if (!m) { pulados.push(`${item.name}: não encontrado`); continue }
      if (m.sku) { pulados.push(`${m.name}: já tem SKU ${m.sku}`); continue }
      if (usados.has(item.sku)) { pulados.push(`${m.name}: SKU ${item.sku} já está em outro material`); continue }
      usados.add(item.sku)
      aplicar.push({ id: m.id, name: m.name, sku: item.sku })
    }

    console.log(SIMULAR ? '\n== SIMULAÇÃO (nada foi gravado) ==\n' : '\n== APLICANDO SKU ==\n')
    for (const a of aplicar) console.log(`  ${a.sku.padEnd(20)} ${a.name}`)
    console.log(`\nSKU a preencher: ${aplicar.length}`)
    if (pulados.length) { console.log(`Pulados: ${pulados.length}`); pulados.forEach((p) => console.log('  - ' + p)) }

    if (!SIMULAR && aplicar.length) {
      await prisma.$transaction(
        aplicar.map((a) => prisma.material.update({ where: { id: a.id }, data: { sku: a.sku } }))
      )
    }
    const depois = await prisma.material.count()
    console.log(`\nMateriais no banco: antes ${antes}, depois ${depois}${antes === depois ? ' (nenhum apagado ou criado)' : ' — ATENÇÃO: mudou!'}`)
    if (SIMULAR) console.log('\nPara gravar: node scripts/aplicar-sku-producao.js')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
