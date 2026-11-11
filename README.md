# Controle BoxCubo

Sistema web interno da Box Cubo para controlar o ciclo de vida das máquinas (BoxCubo V2, Slim, Vision, EYE): estoque, produção, entregas, devoluções, materiais/BOM, compras, auditoria e relatórios.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind (pasta `frontend/`)
- **Backend:** Node.js + Express + Prisma (pasta `backend/`)
- **Banco:** SQLite em arquivo, sem servidor de banco

## Rodar em localhost

Pré-requisito: **Node.js 20 ou mais novo** (o projeto roda hoje em Node 24). Não precisa instalar banco nem mais nada.

São dois processos, cada um em um terminal.

### 1. Backend (porta 3001)

```
cd backend
npm install
npx prisma db push
npm run dev
```

`npx prisma db push` cria o banco vazio em `backend/prisma/prisma/dev.db` e gera o Prisma Client. Só precisa rodar de novo quando o `prisma/schema.prisma` mudar.

O arquivo `backend/.env` já vem no pacote com `DATABASE_URL="file:./prisma/dev.db"`. O caminho é relativo à pasta do schema, por isso o banco fica em `prisma/prisma/`.

Quando subir, aparece `Server running on http://0.0.0.0:3001`. Teste: http://localhost:3001/api/system

### 2. Frontend (porta 5173)

```
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. O Vite repassa tudo que começa com `/api` para o backend na 3001, então o backend precisa estar rodando.

### O banco começa vazio

Não há seed. Para ter dados de teste, cadastre pela interface: um cliente em **Clientes**, máquinas em **Cadastrar** (ou vários de uma vez em **Estoque → Importar CSV**, que tem um modelo para baixar) e materiais em **Materiais**.

O sistema não tem login. É decisão de projeto, não é algo faltando.

## Conferir antes de entregar uma mudança

Não há testes automatizados. A verificação é checagem de tipos, build e teste manual no navegador:

```
cd backend
npx tsc --noEmit

cd ../frontend
npx tsc --noEmit
npm run build
```

O `vite build` avisa que o bundle é grande. É só aviso.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `@prisma/client did not initialize yet` ou erro de tipos do Prisma no `tsc` | Falta gerar o client: `npx prisma generate` dentro de `backend/` |
| Erro de coluna ou tabela inexistente depois de mexer no schema | Rodar `npx prisma db push` dentro de `backend/` |
| `EADDRINUSE` na porta 3001 | Ficou um processo do `ts-node-dev` órfão. No Windows: `Get-NetTCPConnection -LocalPort 3001` para achar o PID e `Stop-Process -Id <pid>` |
| Tela abre mas as listas dão erro | O backend não está rodando, ou não está na 3001 |
| Quer zerar o banco | Parar o backend, apagar `backend/prisma/prisma/dev.db` e rodar `npx prisma db push` |

## Onde está cada coisa

```
backend/
  prisma/schema.prisma   modelos do banco
  src/index.ts           servidor Express e registro das rotas
  src/routes/            uma rota por módulo (machines, production, deliveries, ...)
  src/lib/               auditoria (logAudit), backup automático, datas
frontend/
  src/App.tsx            rotas das páginas
  src/pages/             uma página por tela
  src/components/        componentes por módulo e ui/ (Button, StatusBadge, ...)
  src/types/             tipos compartilhados das telas
  tailwind.config.ts     cores da marca e neutros
.planning/               histórico de planejamento (requisitos, roadmap, fases)
docs/memoria-ia/         contexto para assistentes de IA
CLAUDE.md                instruções para assistentes de IA (leia também se for humano)
```

## Trabalhando com IA (Claude Code, Cursor, Codex etc.)

O pacote já vem preparado:

- `CLAUDE.md` na raiz é carregado sozinho pelo Claude Code e puxa os arquivos de `docs/memoria-ia/`.
- `AGENTS.md` aponta para o mesmo conteúdo, para as ferramentas que leem esse nome.

Abra a ferramenta **na raiz do projeto** (não dentro de `backend/` ou `frontend/`), senão ela não acha essas instruções.

Se a IA parecer perdida, peça: "leia o CLAUDE.md e os arquivos de docs/memoria-ia antes de continuar".

## Git

Este pacote veio sem o histórico do git. Para versionar suas mudanças:

```
git init
git add .
git commit -m "Versao recebida da Box Cubo"
```

O `.gitignore` já deixa de fora `node_modules`, builds, o banco e o `.env`.

## Produção

O sistema roda em um Raspberry Pi na rede interna da Box Cubo. O deploy é feito pela Box Cubo, não faz parte do ambiente local. O que isso exige do código está em `docs/memoria-ia/deploy-producao.md`.
