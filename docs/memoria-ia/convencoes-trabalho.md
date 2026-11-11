# Convenções de trabalho

## Como o dono do projeto gosta que se trabalhe

- Agilidade: mudança reversível se faz direto, sem pedir confirmação a cada passo. Confirmação só para o que é difícil de desfazer (apagar dados, mudar o schema de um jeito que perde coluna).
- Um commit por entrega, com mensagem curta em português, sem prefixos como `feat:` ou `fix:`. Exemplos do histórico:
  - `Linha da tabela de maquinas abre o detalhe (Vendas/Alugueis e Estoque)`
  - `Corrige erro interno ao salvar data com ano de 5 digitos (ex: 20226)`
  - `Aba Compras: receitas de maquinas geram lista de itens com precos, links e exportacao CSV`
- Texto da interface em português, no vocabulário da fábrica: série, OP, flash, romaneio.

## Verificação

Sem testes automatizados. Antes de considerar algo pronto:

1. `npx tsc --noEmit` em `backend/` e em `frontend/`
2. `npm run build` em `frontend/`
3. Abrir a tela no navegador e usar a funcionalidade de verdade

Se criou uma rota, chame-a com o backend rodando e confira a resposta.

## O que não fazer

- Não implementar login, permissões ou qualquer autenticação.
- Não trocar a stack nem adicionar servidor de banco.
- Não criar o status "ESTOQUE". Estoque é tipo de máquina, não status.
- Não criar fluxo de produção diferente por produto. É o mesmo para os quatro.
- Não adicionar dependência pesada sem necessidade: a produção roda em um Raspberry Pi 3B.
- Não fugir do design system (`design-system.md`). O dono pediu explicitamente que o app não pareça feito por IA.

## Cuidados com o schema

A produção tem dados reais e recebe o schema por `prisma db push`. Mudanças que só adicionam (coluna opcional, coluna com default, tabela nova) passam sem problema. Renomear ou remover coluna, ou tornar obrigatório algo que era opcional, faz o `db push` querer apagar dados. Nesses casos, avise a Box Cubo e combine como migrar antes de entregar.

## Rotas do Express

Rota fixa vem antes de rota com parâmetro no mesmo arquivo. Já houve bug em que `GET /api/machines/export.csv` caía em `GET /:id` e respondia 404.
