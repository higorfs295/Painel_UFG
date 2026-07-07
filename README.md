# Painel Acadêmico — base do projeto (monólito modular)

Evolução do protótipo em artefato para uma aplicação real multiusuário, com autenticação,
papéis (admin/usuário), múltiplos cursos e os módulos de progresso/optativas/atividades/cronograma.
Leia primeiro `ESPECIFICACAO.md`.

## Estrutura

- `backend/` — API Node.js + TypeScript (Fastify) + Prisma + PostgreSQL
- `frontend/` — React + Vite + TypeScript (componentes portados do protótipo)
- `docker-compose.yml` — Postgres local (e, futuramente, API + web)

## Por que não há versões fixadas nos package.json

Para não te entregar números de versão que eu não posso verificar hoje, as dependências
são instaladas pelos comandos abaixo (o npm grava as versões atuais no lockfile). Confira
sempre a documentação oficial de cada biblioteca — APIs mudam entre versões maiores.

## Subir o ambiente (passo a passo)

1. `docker compose up -d db`
2. `cd backend && cp ../.env.example .env`
3. `npm init -y` (se necessário) e instale:
   `npm i fastify @fastify/cors @fastify/helmet @fastify/rate-limit @fastify/jwt @fastify/cookie zod argon2 @prisma/client`
   `npm i -D typescript tsx prisma @types/node`
4. `npx prisma migrate dev --name init`
5. `SEED_ADMIN_PASSWORD='defina-uma-senha-forte' npx tsx src/seed/seed.ts`
6. `npx tsx src/server.ts`
7. `cd ../frontend && npm create vite@latest . -- --template react-ts` (aceite mesclar) e depois
   `npm i @tanstack/react-query react-router-dom zustand`
8. `npm run dev`

## Estado do código

Esqueleto compilável com módulos stub: contratos, tipos, schema de dados e lógica de domínio
(parser SIGAA e grafo de requisitos) estão completos; handlers marcados com TODO seguem a
especificação (RF-xx) para você implementar como projeto.
