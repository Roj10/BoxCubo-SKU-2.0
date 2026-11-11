# Controle BoxCubo — Guia do Projeto

## O que é

Sistema web interno da Box Cubo para controlar o ciclo de vida das máquinas (BoxCubo V2, Slim, Vision, EYE), do estoque ao cliente, passando por produção, entregas e devoluções. Substituiu planilhas manuais e está em uso na fábrica.

## Contexto que você deve ler

Estes arquivos são a memória do projeto, trazida das sessões de quem o construiu. Valem como instrução:

- @docs/memoria-ia/contexto-projeto.md — o que existe hoje, módulos, decisões técnicas
- @docs/memoria-ia/design-system.md — regras de UI, obrigatórias para qualquer tela nova
- @docs/memoria-ia/convencoes-trabalho.md — como verificar, commitar e o que não fazer
- @docs/memoria-ia/deploy-producao.md — onde roda em produção e o que isso exige do código

Como rodar em localhost: `README.md`.

## Estado atual

Os milestones v1 e v2.0 estão completos, e depois deles vieram incrementos (backup automático, cliente 360º, Modo TV, calendário de entregas, importação CSV, aba Compras, BOM multinível com subconjuntos fabricados). Não há fase em andamento: o trabalho agora é manutenção e mudanças pontuais.

A pasta `.planning/` (histórico de como o sistema foi construído) fica só na cópia local e não vai para o repositório. Quando ela e o código discordarem, vale o código.

## Stack

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS, porta 5173, proxy de `/api` para o backend
- Backend: Node.js + Express + TypeScript, porta 3001
- Banco: SQLite + Prisma, sem migrations: o schema é aplicado com `npx prisma db push`
- Sem testes automatizados

## Regras de negócio

- Sistema sem autenticação, acesso livre na rede interna. Não implementar login.
- Mesmo fluxo de produção para todos os produtos: `RECEBIMENTO → MONTAGEM → FLASH_FIRMWARE → TESTE → EMBALAGEM`. Na interface, `RECEBIMENTO` aparece como "Análise" e `FLASH_FIRMWARE` como "Flash".
- O número de série é opcional no cadastro e obrigatório para a máquina entrar na etapa de Flash.
- Devoluções têm dois destinos: ESTOQUE direto ou fluxo de revisão/manutenção.
- Tipos de máquina (situação comercial): VENDA, ALUGUEL, ESTOQUE.
- Status da máquina: `AGUARDANDO_PRODUCAO` (inicial) → `EM_PRODUCAO` → `PRONTO_ENVIO` → `ENTREGUE` → (devolução) `EM_REVISAO`. Devolução direta ao estoque e revisão concluída voltam como `PRONTO_ENVIO`. Não existe status "ESTOQUE": estoque é só o tipo.
- Plano Suporte é booleano (sim/não), exibido apenas para BoxCubo V2.
- BOM: um item de receita tem como pai um produto (`product_type`) ou um material fabricado (`parent_material_id`), nunca os dois.
- Mudanças em máquinas, entregas, devoluções e etapas gravam auditoria com `logAudit` (`backend/src/lib/audit.ts`). Rota nova que altera dados deve fazer o mesmo.

## Antes de dizer que terminou

```
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit && npm run build
```

Se mexeu em `backend/prisma/schema.prisma`: `npx prisma db push` dentro de `backend/`. Depois, teste a tela no navegador com backend e frontend rodando.

## GSD (opcional)

O projeto foi construído com o fluxo GSD (`/gsd:discuss-phase`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`), que é o que gerou a pasta `.planning/`. Esses comandos só existem se o plugin GSD estiver instalado. Sem ele, trabalhe normalmente.
