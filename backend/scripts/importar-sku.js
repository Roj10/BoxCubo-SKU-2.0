// ============================================================
//  IMPORTAR SKUs E RECEITAS DO SISTEMA DE SKU
// ============================================================
//  Lê scripts/sku-dados.json (peças com SKU e as receitas da BoxCubo V2,
//  Vision, EYE e dos subconjuntos) e grava no banco do Controle:
//
//   - material que já tem o mesmo SKU: fica como está (só confere);
//   - material com o MESMO NOME e sem SKU: ganha o SKU (estoque, preço e
//     nome não mudam; preço só é preenchido se estava vazio);
//   - material que não existe: é criado com nome, SKU, unidade, estoque e
//     preço do sistema de SKU;
//   - receitas: cada item é adicionado, ou tem a quantidade atualizada se
//     já estava na receita. Nada é apagado das receitas;
//   - fornecedores (com o código do item): só entram no material que ainda
//     não tem nenhum fornecedor;
//   - estoque mínimo (materiais para N máquinas de cada produto): só é
//     gravado para o produto que ainda não tem mínimo definido.
//  O estoque dos materiais criados entra como uma movimentação "Ajuste"
//  (aparece em Movimentações).
//
//  Como usar (dentro de backend/, com o "npx prisma db push" já feito):
//    node scripts/importar-sku.js --simular   mostra o que faria, sem gravar
//    node scripts/importar-sku.js             grava
//
//  Pode rodar mais de uma vez: o que já está igual não muda.

const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

const SIMULAR = process.argv.includes('--simular')
const dados = JSON.parse(fs.readFileSync(path.join(__dirname, 'sku-dados.json'), 'utf8'))
const prisma = new PrismaClient()

// nomes comparados sem diferença de maiúsculas, acentos ou espaços extras
const chave = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

class Simulacao extends Error {}

async function main() {
  const r = { criados: 0, vinculados: 0, jaTinham: 0, ambiguos: [], conflitos: [], itensNovos: 0, itensAtualizados: 0, itensIguais: 0, fornecedores: 0, minimos: 0 }

  await prisma
    .$transaction(
      async (tx) => {
        const todos = await tx.material.findMany()
        const porSku = new Map(todos.filter((m) => m.sku).map((m) => [m.sku, m]))
        const porNome = new Map()
        for (const m of todos.filter((m) => !m.sku)) {
          const k = chave(m.name)
          porNome.set(k, porNome.has(k) ? 'VARIOS' : m)
        }
        const idDoSku = new Map()
        const estoqueInicial = [] // materiais criados com estoque (vira movimentação)

        // ---- 1. materiais ----
        for (const p of dados.pecas) {
          let m = porSku.get(p.sku)
          if (m) {
            r.jaTinham++
          } else {
            const achado = porNome.get(chave(p.nome))
            if (achado === 'VARIOS') {
              r.ambiguos.push(`${p.sku} (${p.nome}): mais de um material com esse nome, nada feito`)
              continue
            }
            if (achado) {
              const data = { sku: p.sku }
              if (achado.price == null && p.preco != null) data.price = p.preco
              if (p.fabricado && !achado.manufactured) data.manufactured = true
              m = await tx.material.update({ where: { id: achado.id }, data })
              porNome.delete(chave(p.nome))
              r.vinculados++
            } else {
              const estoque = Math.max(0, Number(p.estoque) || 0)
              m = await tx.material.create({
                data: {
                  name: p.nome,
                  sku: p.sku,
                  unit: p.unidade || 'un',
                  current_stock: estoque,
                  price: p.preco ?? null,
                  manufactured: !!p.fabricado,
                },
              })
              if (estoque > 0) estoqueInicial.push(m)
              r.criados++
            }
          }
          if (p.fabricado && !m.manufactured) {
            m = await tx.material.update({ where: { id: m.id }, data: { manufactured: true } })
          }
          idDoSku.set(p.sku, m.id)

          // fornecedores: só se o material ainda não tiver nenhum
          const forn = (p.fornecedores || []).filter((f) => f.nome && f.nome.trim())
          if (forn.length && (await tx.materialSupplier.count({ where: { material_id: m.id } })) === 0) {
            const vistos = new Set()
            let pos = 0
            for (const f of forn) {
              const k = f.nome.trim().toLowerCase()
              if (vistos.has(k)) continue
              vistos.add(k)
              await tx.materialSupplier.create({
                data: { material_id: m.id, name: f.nome.trim(), code: (f.codigo || '').trim() || null, position: pos++ },
              })
              r.fornecedores++
            }
          }
        }

        // estoque dos materiais criados: uma movimentação "Ajuste" com todos
        if (estoqueInicial.length) {
          await tx.materialMovement.create({
            data: {
              type: 'AJUSTE',
              actor: 'Sistema',
              note: 'Estoque trazido do sistema de SKU',
              items: {
                create: estoqueInicial.map((m) => ({
                  material_id: m.id, material_name: m.name, sku: m.sku, unit: m.unit,
                  quantity: m.current_stock, before: 0, after: m.current_stock,
                })),
              },
            },
          })
        }

        // estoque mínimo por produto (só onde ainda não foi definido)
        for (const [produto, n] of Object.entries(dados.minimo_maquinas || {})) {
          if (!n) continue
          const ja = await tx.productStockTarget.findUnique({ where: { product_type: produto } })
          if (!ja) {
            await tx.productStockTarget.create({ data: { product_type: produto, min_machines: n } })
            r.minimos++
          }
        }

        // ---- 2. receitas ----
        const gravarItem = async (onde, sku, quantidade, dono) => {
          const material_id = idDoSku.get(sku)
          if (!material_id) {
            r.conflitos.push(`${dono}: ${sku} não foi importado, item pulado`)
            return
          }
          const existente = await tx.bomItem.findFirst({ where: { ...onde, material_id } })
          if (!existente) {
            await tx.bomItem.create({ data: { ...onde, material_id, quantity: quantidade } })
            r.itensNovos++
          } else if (Math.abs(existente.quantity - quantidade) > 1e-9) {
            await tx.bomItem.update({ where: { id: existente.id }, data: { quantity: quantidade } })
            r.itensAtualizados++
          } else {
            r.itensIguais++
          }
        }
        for (const [produto, itens] of Object.entries(dados.receitas)) {
          for (const it of itens) await gravarItem({ product_type: produto }, it.sku, it.quantidade, produto)
        }
        for (const [skuPai, itens] of Object.entries(dados.subconjuntos)) {
          const pai = idDoSku.get(skuPai)
          if (!pai) {
            r.conflitos.push(`subconjunto ${skuPai} não foi importado, receita pulada`)
            continue
          }
          for (const it of itens) {
            if (it.sku === skuPai) continue
            await gravarItem({ parent_material_id: pai }, it.sku, it.quantidade, skuPai)
          }
        }

        const mudou = r.criados + r.vinculados + r.itensNovos + r.itensAtualizados + r.fornecedores + r.minimos > 0
        if (mudou) await tx.auditLog.create({
          data: {
            entity_type: 'Material',
            entity_id: 'importacao-sku',
            action: 'IMPORT',
            actor: 'Sistema',
            summary: `Importou SKUs e receitas do sistema de SKU: ${r.criados} materiais criados, ${r.vinculados} ganharam SKU, ${r.itensNovos} itens de receita adicionados e ${r.itensAtualizados} atualizados`,
            metadata: JSON.stringify({ origem: dados.origem, gerado_em: dados.gerado_em }),
          },
        })

        if (SIMULAR) throw new Simulacao()
      },
      { timeout: 120000 }
    )
    .catch((e) => {
      if (!(e instanceof Simulacao)) throw e
    })

  console.log(SIMULAR ? '\nSIMULAÇÃO (nada foi gravado):' : '\nImportação concluída:')
  console.log(`  materiais criados ........... ${r.criados}`)
  console.log(`  materiais que ganharam SKU .. ${r.vinculados}  (achados pelo nome)`)
  console.log(`  já tinham o SKU ............. ${r.jaTinham}`)
  console.log(`  itens de receita novos ...... ${r.itensNovos}`)
  console.log(`  itens com qtd. atualizada ... ${r.itensAtualizados}`)
  console.log(`  itens que já estavam iguais . ${r.itensIguais}`)
  console.log(`  fornecedores adicionados .... ${r.fornecedores}`)
  console.log(`  mínimos por produto gravados  ${r.minimos}  (${Object.entries(dados.minimo_maquinas || {}).map(([p, n]) => `${p} ${n}`).join(', ')})`)
  for (const a of [...r.ambiguos, ...r.conflitos]) console.log('  ATENÇÃO: ' + a)
}

main()
  .catch((e) => {
    console.error('Não foi possível importar:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
