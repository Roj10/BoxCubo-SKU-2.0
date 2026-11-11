// ============================================================
//  SINCRONIZAR ESTOQUE COM O SISTEMA EM USO (servidor de produção)
// ============================================================
//  Lê scripts/estoque-producao.json (cópia de /api/materials do Controle
//  que está rodando na empresa) e acerta este banco:
//
//   - estoque atual: diferenças entram numa movimentação "Ajuste" só
//     (aparece em Movimentações, com o antes/depois de cada material);
//   - estoque cheio (full_stock): copiado de lá;
//   - material que existe lá e não existe aqui: é criado (sem SKU);
//   - material que só existe aqui (veio do sistema de SKU): fica como está.
//  Nome, SKU, foto, fornecedores e receitas daqui não mudam.
//
//  Como usar (dentro de backend/):
//    node scripts/sincronizar-estoque.js --simular   mostra o que faria
//    node scripts/sincronizar-estoque.js             grava
//
//  Pode rodar de novo: o que já está igual não muda.

const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

const SIMULAR = process.argv.includes('--simular')
const ATOR = process.env.ATOR || 'Sistema' // quem aparece na movimentação
const NOTA = 'Sincronizado com o estoque do sistema de produção'
const producao = JSON.parse(fs.readFileSync(path.join(__dirname, 'estoque-producao.json'), 'utf8'))

// Nomes que lá estão diferentes daqui (nome de lá -> SKU daqui)
const POR_NOME = {
  'Abraçadeira Plástica M': 'EMB-EMB-ABRM',
  'Abraçadeira Plástica P': 'EMB-EMB-ABRP',
  'Webcam 4k ??? kkk': 'ELE-PER-WEBCAM4K',
  'CPU': 'ELE-SUB-CPUV2',
}
// Lá existem dois "Shield Sensor": vale o novo (fabricado, 09/11); o antigo é ignorado.
const POR_ID = { cmw9dgb580038135k173mjqw6: 'ELE-PCB-SHIELDSENS' }
const IGNORAR = new Set(['cmst0yngh001lkdbt21olpfiy'])

const chave = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const r3 = (n) => Math.round(n * 1000) / 1000

class Simulacao extends Error {}

async function main(prisma) {
  const rel = { ajustes: [], cheio: 0, criados: [], ignorados: [] }
  await prisma
    .$transaction(
      async (tx) => {
        const todos = await tx.material.findMany()
        const porSku = new Map(todos.filter((m) => m.sku).map((m) => [m.sku, m]))
        const porNome = new Map()
        for (const m of todos) {
          const k = chave(m.name)
          porNome.set(k, porNome.has(k) ? 'VARIOS' : m)
        }
        const mudancas = []
        for (const p of producao) {
          if (IGNORAR.has(p.id)) { rel.ignorados.push(`${p.name} (duplicado antigo lá)`); continue }
          const sku = POR_ID[p.id] ?? POR_NOME[p.name]
          let m = sku ? porSku.get(sku) : porNome.get(chave(p.name))
          if (m === 'VARIOS') { rel.ignorados.push(`${p.name} (mais de um com esse nome aqui)`); continue }
          if (!m) {
            const novo = await tx.material.create({
              data: { name: p.name, unit: p.unit || 'un', current_stock: 0, full_stock: p.full_stock || 0, manufactured: !!p.manufactured },
            })
            rel.criados.push(`${p.name} (${p.current_stock} ${p.unit})`)
            if (p.current_stock) mudancas.push({ material_id: novo.id, quantity: r3(p.current_stock) })
            continue
          }
          if ((m.full_stock ?? 0) !== (p.full_stock ?? 0)) {
            await tx.material.update({ where: { id: m.id }, data: { full_stock: p.full_stock ?? 0 } })
            rel.cheio++
          }
          const dif = r3(p.current_stock - m.current_stock)
          if (dif !== 0) {
            mudancas.push({ material_id: m.id, quantity: dif })
            rel.ajustes.push(`${(m.sku ?? '').padEnd(20)} ${m.name}: ${m.current_stock} -> ${p.current_stock}`)
          }
        }
        // uma movimentação "Ajuste" com todas as diferenças
        const items = []
        for (const c of mudancas) {
          const m = await tx.material.update({ where: { id: c.material_id }, data: { current_stock: { increment: c.quantity } } })
          items.push({ material_id: m.id, material_name: m.name, sku: m.sku, unit: m.unit, quantity: c.quantity, before: r3(m.current_stock - c.quantity), after: m.current_stock })
        }
        if (items.length) {
          await tx.materialMovement.create({ data: { type: 'AJUSTE', actor: ATOR, note: NOTA, items: { create: items } } })
        }
        if (SIMULAR) throw new Simulacao()
      },
      { timeout: 60000 }
    )
    .catch((e) => { if (!(e instanceof Simulacao)) throw e })

  console.log(SIMULAR ? '\n== SIMULAÇÃO (nada foi gravado) ==\n' : '\n== SINCRONIZADO ==\n')
  console.log(`Estoque ajustado: ${rel.ajustes.length} materiais`)
  rel.ajustes.forEach((l) => console.log('  ' + l))
  console.log(`Estoque cheio atualizado: ${rel.cheio} materiais`)
  console.log(`Criados: ${rel.criados.length}`)
  rel.criados.forEach((l) => console.log('  ' + l))
  if (rel.ignorados.length) { console.log('Ignorados:'); rel.ignorados.forEach((l) => console.log('  ' + l)) }
  if (SIMULAR) console.log('\nPara gravar: node scripts/sincronizar-estoque.js')
}

module.exports = { main }
if (require.main === module) {
  const prisma = new PrismaClient()
  main(prisma)
    .catch((e) => { console.error(e); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}
