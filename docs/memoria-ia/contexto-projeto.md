# Contexto do projeto

Sistema web interno da Box Cubo que substituiu uma planilha de cerca de 10 abas, sem rastreabilidade, usada para controlar as máquinas. Está em produção na fábrica desde julho de 2026.

**Produtos controlados:** BoxCubo V2, Slim, Vision, EYE. No código: `BOXCUBO_V2`, `SLIM`, `VISION`, `EYE`.

## Módulos e onde ficam

| Módulo | Tela (rota) | Backend |
|---|---|---|
| Dashboard, tendências, resumo inteligente, capacidade de produção | `/dashboard` | `routes/dashboard.ts` |
| Modo TV para o telão da fábrica (fora do AppShell, atualiza a cada 15s) | `/tv` | `routes/dashboard.ts` |
| Estoque e Vendas/Aluguéis (listas de máquinas, ações em massa) | `/estoque`, `/vendas` | `routes/machines.ts` |
| Cadastro, edição e importação CSV de máquinas | `/cadastrar`, `/estoque/novo`, `/estoque/importar` | `routes/machines.ts` |
| Detalhe da máquina: timeline, tempos por etapa, etiqueta com QR | `/maquinas/:id` | `routes/machines.ts` |
| Ordem de Produção (checklist de montagem preenchido no site) | `/maquinas/:id/op` | `routes/production.ts` |
| Produção (Kanban com arrastar e soltar) | `/producao` | `routes/production.ts` |
| Entregas: lista, calendário, romaneio para impressão | `/entregas` | `routes/deliveries.ts` |
| Devoluções e revisão | `/devolucoes` | `routes/returns.ts` |
| Clientes e visão 360º do cliente | `/clientes`, `/clientes/:id` | `routes/clients.ts` |
| Materiais e BOM multinível, fabricação de subconjunto | `/materiais` | `routes/materials.ts`, `routes/bom.ts` |
| Materiais: SKU, Subconjuntos, Movimentações de material, Reposição (mínimo por produto) e Fornecedores (abas da página Materiais) | `/materiais` | `routes/materialMovements.ts`, `routes/replenishment.ts`, `routes/suppliers.ts`, `lib/stockMovements.ts`, `lib/stockTargets.ts` |
| Compras (lista de itens a partir das receitas, preços, links, CSV) | `/compras` | `routes/purchases.ts` |
| Auditoria | `/auditoria` | `routes/audit.ts`, `lib/audit.ts` |
| Alertas (sino no cabeçalho) | — | `routes/alerts.ts` |
| Relatório do período | `/relatorio` | `routes/dashboard.ts` |
| Sistema: backups e diagnóstico | `/sistema` | `routes/backups.ts`, `routes/system.ts`, `lib/backup.ts` |
| Busca global | cabeçalho | `routes/search.ts` |

Os três PDFs "Checklist de Montagem" na raiz são os checklists em papel que deram origem à Ordem de Produção do site.

## Decisões técnicas

- React + Node.js + SQLite + Prisma. Stack decidida, não trocar.
- Sem autenticação: é ferramenta de rede interna. Onde é preciso saber quem fez algo, a tela pede o nome e ele vai como `created_by` ou `actor`.
- O banco fica em `backend/prisma/prisma/dev.db`, porque o `DATABASE_URL` (`file:./prisma/dev.db`) é relativo à pasta do schema.
- Sem migrations do Prisma. O schema é aplicado com `npx prisma db push`.
- Backup automático diário do SQLite via `VACUUM INTO`, na pasta `backend/backups/`, guardando os 14 mais recentes. Dá para gerar e baixar pela tela `/sistema`.
- Status, tipos e etapas são `String` no banco (SQLite não tem enum). Os valores válidos estão nas rotas e em `frontend/src/types/`.
- Exportações CSV usam `;` como separador e BOM UTF-8, para abrir direto no Excel em português.
- Datas: há tratamento em `backend/src/lib/dates.ts` contra datas inválidas (por exemplo ano com 5 dígitos). Use esse helper ao receber datas do cliente.

## Riscos conhecidos

- Não há testes automatizados. Tudo foi verificado por `tsc`, build e teste manual.
- Parar o `ts-node-dev` com Ctrl-C pode deixar um processo filho preso na porta 3001.

## Estoque de materiais (vindo do sistema de SKU)

- Material tem `sku` opcional e único (GRUPO-CLASSE-FINAL, ex: ELE-RES-10).
- Toda mudança de estoque de material passa por `applyStockMovement` (`lib/stockMovements.ts`), que grava a movimentação com antes/depois: produção (início e cancelamento), fabricação de subconjunto, entrada, saída, ajuste no cadastro e estorno. Rota nova que mexe em `current_stock` deve usar essa função.
- Estoque mínimo: `ProductStockTarget` guarda "material para N máquinas" por produto; o mínimo de cada material sai da receita (subconjuntos abertos nos componentes, `lib/stockTargets.ts`). É diferente do "estoque cheio" (alerta de 20%), que continua igual.
- Fornecedores: `MaterialSupplier` (position 0 = principal, entra no pedido da Reposição).
- `backend/scripts/importar-sku.js` traz SKUs, receitas, fornecedores e mínimos do sistema de SKU (`--simular` para ver sem gravar).
