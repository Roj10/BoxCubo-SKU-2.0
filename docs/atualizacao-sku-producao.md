# Atualização da produção (Raspberry) com o sistema de SKU

Leva para o Raspberry tudo o que foi feito em Materiais: SKU, fotos, quem
editou, Subconjuntos, Movimentações, Reposição, Fornecedores e localização
(estantes E, prateleiras P e caixas C).

**Nenhum material é apagado.** A mudança no banco só ACRESCENTA tabelas e
campos. Os materiais que já existem (Adesivo CPU V2, Arruela Plástica 1/4…)
continuam com o mesmo nome, estoque, preço e receita.

## O que muda no banco (só acréscimos)

Campos novos em `materials` (todos vazios no começo):
`sku`, `image_updated_at`, `edited_by`, `edited_at`, `rack_id`, `rack_level`, `rack_box`.

Tabelas novas:
`material_suppliers`, `material_movements`, `material_movement_items`,
`product_stock_targets`, `material_images`, `storage_racks`, `storage_shelves`.

Nenhum campo ou tabela que existe hoje é removido ou renomeado.
Não há dependência nova no backend.

## Passo a passo

No PC (pasta `controle-boxcubo`):

1. `cd frontend` → `npm run build`
2. `cd ../backend` → `npm run build`

No Raspberry:

3. **Backup do banco** (antes de tudo):
   `cp prisma/prisma/dev.db prisma/prisma/dev.db.antes-sku-$(date +%F)`
4. `sudo systemctl stop boxcubo`
5. Copiar do PC para a pasta do app no Pi:
   - `backend/dist/` → `dist/`
   - `frontend/dist/` (build do frontend) → `public/`
   - `backend/prisma/schema.prisma` → `prisma/schema.prisma`
   - `backend/scripts/aplicar-sku-producao.js` e `backend/scripts/sku-producao.json` → `scripts/`
6. Atualizar o banco (só acrescenta):
   `npx prisma db push --skip-generate && npx prisma generate`
   - **Não** use `--accept-data-loss`. Se o Prisma avisar que vai perder
     dados, PARE e não confirme: isso não deveria acontecer com esta mudança.
7. Conferir antes de gravar os SKUs:
   `node scripts/aplicar-sku-producao.js --simular`
   Deve listar os SKUs a preencher e terminar com
   "Materiais no banco: antes N, depois N (nenhum apagado ou criado)".
8. Gravar os SKUs: `node scripts/aplicar-sku-producao.js`
   (só preenche o SKU de quem não tem; não cria nem apaga material)
9. `sudo systemctl start boxcubo` e abrir http://<IP-do-servidor>/materiais

## Depois de subir

- Reposição: definir o mínimo de máquinas (V2 10, EYE 30, Vision 5) na aba Reposição.
- Localização: criar as estantes pelo "Gerenciar estantes" (editar material) ou clicando na coluna Local.
- Material novo cadastrado depois de 11/11 não recebe SKU pelo script; coloque na edição do material.
- Nome é pedido ao editar material, fabricar, mexer em fornecedores e estornar.

## Se der problema

`sudo systemctl stop boxcubo`, voltar o backup
(`cp prisma/prisma/dev.db.antes-sku-AAAA-MM-DD prisma/prisma/dev.db`),
voltar `dist/` e `public/` antigos e `sudo systemctl start boxcubo`.
