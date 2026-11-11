# Produção (Raspberry Pi)

O sistema roda em um Raspberry Pi 3B na rede interna da Box Cubo. **O deploy é feito pela Box Cubo.** Endereço, usuário e senha do servidor não acompanham este pacote de propósito. Se precisar de acesso, peça à Box Cubo.

Este arquivo existe para que o código continue compatível com esse ambiente.

## Como é o ambiente

- Raspberry Pi 3B (1 GB de RAM), Debian Trixie arm64.
- Serviço systemd `boxcubo`, rodando como usuário comum, na porta 80 (`Environment=PORT=80`), com reinício automático.
- Pasta do app no Pi: `dist/` com o backend compilado, `public/` com o build do frontend, `prisma/prisma/dev.db` com o banco.
- O banco de produção tem dados reais desde 2026-07-03.

## O que isso exige do código

- `backend/src/index.ts` lê a porta de `process.env.PORT` (padrão 3001) e escuta em `0.0.0.0`. Manter.
- Em produção o próprio backend serve o frontend: se existir a pasta `../public` ao lado de `dist/`, ele a serve como estático e devolve `index.html` para qualquer rota que não comece com `/api`. Por isso toda rota de API precisa ficar sob `/api`, e o frontend deve chamar a API por caminho relativo (`/api/...`), nunca por `http://localhost:3001`.
- O backend precisa compilar com `npm run build` (`tsc`) e rodar com `node dist/index.js`.
- O frontend precisa passar em `npm run build`.
- Hardware fraco: evite dependência pesada no backend e processamento grande em memória.

## Procedimento de atualização (feito pela Box Cubo)

1. `npm run build` em `frontend/` e em `backend/`.
2. Copiar `backend/dist` e o build do frontend (para `public/`) para o Pi.
3. Se o `schema.prisma` mudou: copiar o schema e rodar no Pi `npx prisma db push --skip-generate && npx prisma generate`, com backup do banco antes.
4. `sudo systemctl restart boxcubo`.

Ao entregar uma mudança, diga se ela altera o `schema.prisma` ou adiciona dependência no backend, porque isso muda os passos acima.
