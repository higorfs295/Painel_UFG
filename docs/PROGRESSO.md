# Progresso da Implementação

## Rodada "preparação open source" (2026-07-09, branch claude/os-prep)

Nove pedidos atendidos sobre a main pós-merge:

1. **Cadastro público (RF-17)** — `POST /auth/register` (gated por `ALLOW_REGISTRATION`) + página
   `/cadastro` + auto-matrícula (`POST /me/enrollments` e seletor de curso no primeiro acesso).
2. **Convite por e-mail (RF-18)** — `lib/mailer` (nodemailer/SMTP opcional) em convite/reset;
   diagnóstico do caso Docker (link montado com `APP_URL` errado) documentado em DEPLOY §7.1.
3. **Design v2** — mais formas/cores/animações: título com traço de pôr do sol, grafismo tribal,
   stats em gradiente, horizonte nas telas de auth, shimmer/float/cascata (com reduced-motion).
4. **Período/férias (RF-20)** — `domain/period` + chip no header + editor em Ajustes
   (`PATCH /me/enrollments/:id`).
5. **Estado CURSANDO (RF-19)** — enum `ENROLLED` + migração; oficial não conta, projeção conta,
   recomendações pulam; botão/chip na UI.
6. **Ajustes ricos** — nome, troca de senha (`POST /me/password`, revoga sessões), período,
   matrículas, tema, backup.
7. **Admin ampliado (RF-21)** — `GET /admin/stats`, papel por select (`PATCH /users/:id`),
   matricular/desmatricular usuários.
8. **Deploy custo-zero** — `render.yaml` + `frontend/vercel.json` + `directUrl` (Neon) +
   `COOKIE_SAMESITE=none`/`TRUST_PROXY`/CORS multi-origem; guia completo em `docs/DEPLOY.md`.
9. **Documentação 2×** — novos DOMINIO/DEPLOY/SEGURANCA/TESTES/CONTRIBUINDO + expansões
   (API/MODULOS/ESPECIFICACAO com RF-17..21/README).

Também: testes realinhados à **integralização limitada ao mínimo** (mudança da main que estava
com CI vermelho), limpeza do diretório `${APPDATA}` commitado por acidente, e espelho
`frontend/src/lib/sums.ts` sincronizado. Verificação: 43 testes backend + 4 E2E verdes; fluxo
cadastro→curso→cursando→projeção conferido no navegador.

---


Registro do que foi implementado e **verificado em execução real** (Node 24 + Postgres em Docker +
navegador), seguindo o `ROADMAP.md`.

## Resumo do estado

| Fase | Descrição | Estado |
| --- | --- | --- |
| **0** | Sanidade do ambiente | ✅ Concluída e verificada |
| **1** | Autenticação ponta a ponta | ✅ Concluída e verificada |
| **2** | Administração de usuários (RF-01) | ✅ Implementada (rotas + UI admin) |
| **3** | Progresso e domínio no servidor (RF-05/06/07) | ✅ Concluída + testada |
| **4** | Extras / cursos / cronograma / backup (RF-08..16) | ✅ Concluída (inclui 4.4) |
| **5** | Frontend funcional | ✅ Concluída e verificada no navegador |
| **6** | Operação e robustez | ✅ Artefatos entregues (Docker/proxy/logs/docs) |

**Cobertura de testes:** 34 automatizados verdes — 22 unitários (domínio + crypto, sem banco) e
12 de integração (rotas via `app.inject` contra Postgres real).

---

## Fase 0 — Sanidade do ambiente ✅
- Boot da API (`/health` → `{"ok":true}`), migration `20260707220537_init` aplicada, seed populando
  curso EngComp (120 disciplinas) + conta `fhigor295@gmail.com` (23 aprovadas, 9 extras).
- Vitest configurado; erro uniforme (`setErrorHandler`) sem vazar stack (RNF-04); typecheck limpo.
- Correções: `schema.prisma` reformatado (sintaxe válida), `.env` via `--env-file`, versões fixadas + lockfile.

## Fase 1 — Autenticação ✅
JWT tipado + `requireAuth`/`requireAdmin`; convite→senha (argon2), login, refresh rotativo com
**detecção de reuso** (revoga a família), logout, reset; rate limit por rota. Coberto por integração.

## Fases 2–4 — Backend de domínio ✅
- **users** (RF-01), **courses/import** (RF-13), **progress** (RF-05/06/07: somas com teto 100% +
  excedente, oficial×simulado, marcos, recomendações), **extras** (RF-08/09), **schedules** (RF-10/11/12
  com validação SIGAA no servidor).
- **4.4 (novo):** `GET /me`, `PATCH /me/settings` (tema, RF-15), `GET /me/export` + `POST /me/import`
  (backup JSON portável por `seq`, restauração transacional, RF-16). Coberto por integração (roundtrip export→wipe→import).

## Fase 5 — Frontend funcional ✅
Stack: React 18 + Vite 6 + TypeScript + TanStack Query + React Router 6 + Zustand.
- Fundação: `main.tsx` (QueryClient + Router), `App.tsx` (boot via refresh + guardas de rota/admin).
- Auth: store Zustand, cliente HTTP com refresh automático em 401, telas de Login e Convite.
- Páginas de domínio consumindo a API: **Overview** (donut, composições com excedente, marcos, recomendações),
  **Disciplinas** (tabela + filtros + simulação APPROVED/SIMULATED + projeção), **Extras** (CRUD),
  **Cronograma** (cenários + disciplinas com SIGAA + grade com pintura), **Ajustes** (tema + export/import),
  **Admin** (criar/convidar/remover usuários + importar matriz).
- **Verificado no navegador:** login como Higor → Overview com dados reais (1737/4132h, NL +158h e AC +119h
  travados em 100%, CH1 ✓) → Disciplinas (status calculado, Cálculo 2A disponível / Cálculo 3A bloqueada) →
  troca de tema persistida → **reload mantém a sessão** (refresh no boot). CORS e cookie httpOnly OK.

## Fase 6 — Operação e robustez ✅
- **6.1 Dockerfiles + compose:** `backend/Dockerfile` (multi-stage, migrate deploy no entrypoint, usuário
  não-root), `frontend/Dockerfile` (build Vite → nginx com fallback SPA), `docker-compose.yml` com
  `db + api + web + caddy` e healthcheck do Postgres.
- **6.2 Proxy TLS:** `deploy/Caddyfile` — TLS automático (interno no local, Let's Encrypt em produção),
  topologia **mesma origem** (roteia `/auth`,`/me`,`/users`,`/courses`,`/health` para a API; resto para o SPA),
  o que faz o cookie de refresh (path `/auth`) casar e dispensa CORS.
- **6.3 Logs sem dados sensíveis (RNF-10):** `redact` do pino em `app.ts` (Authorization, cookies,
  set-cookie, password/hash/token).
- **6.4 Backup:** documentado abaixo; RF-16 já implementado (export/import por usuário).

---

## Como rodar

### Dev (backend/front no host, Postgres no Docker)
```bash
# Postgres isolado (o plugin `docker compose` v2 não está instalado nesta máquina — use docker run):
docker run -d --name painel-lovingnash-db -e POSTGRES_USER=painel -e POSTGRES_PASSWORD=painel \
  -e POSTGRES_DB=painel -p 5432:5432 -v painel_lovingnash_dbdata:/var/lib/postgresql/data postgres:16

# backend
cd backend && cp .env.example .env   # ajuste JWT_SECRET e SEED_ADMIN_PASSWORD
export NODE_EXTRA_CA_CERTS="C:\\ProgramData\\Avast Software\\Avast\\wscert.pem"   # ver nota Avast
npm install && npm run migrate && npm run seed
npm run dev            # http://localhost:3333
npm test && npm run test:integration

# frontend
cd ../frontend && npm install
npm run dev            # http://localhost:5173  (login: fhigor295@gmail.com / a senha do seed)
```

### Stack completa (Docker Compose — requer o plugin v2)
```bash
cp .env.example .env   # defina JWT_SECRET
docker compose up --build
docker compose run --rm -e SEED_ADMIN_PASSWORD='...' api npm run seed   # semear 1x
# acesse https://localhost  (aceite o certificado interno do Caddy no local)
```

### Backup (RF-16)
Em **Ajustes** o usuário exporta um JSON com todos os seus dados (status, extras, cenários, tema) e pode
reimportar para reconstruir o estado. O backup referencia disciplinas por `seq`, então sobrevive a
re-seed/reimportação da matriz. Backup do banco: `pg_dump` do volume `dbdata` (documentar rotina no deploy).

## Nota de ambiente (Avast + TLS)
O Avast intercepta HTTPS; `npm install` falha intermitentemente com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
Correção segura (sem desabilitar verificação): `export NODE_EXTRA_CA_CERTS="C:\\ProgramData\\Avast Software\\Avast\\wscert.pem"`
(a env var do sistema existe mas com barra dupla no caminho, que quebra a leitura). Dentro do build Docker,
o mesmo MITM pode afetar o `npm ci` — em rede sem interceptação os Dockerfiles constroem normalmente.

## E2E (Playwright) e CI — feitos
- **E2E**: `frontend/e2e/` cobre auth (erro uniforme + login), simulação de disciplina (projeção) e a
  grade por teclado (setas + Enter pinta/limpa + exclusão). Rodam em série contra a conta semeada e se
  auto-limpam. Local (Windows/git-bash): `E2E_USER_PASSWORD='<senha do seed>' node node_modules/@playwright/test/cli.js test`
  (o wrapper `npx.cmd` descarta prefixos de env). No CI: job `e2e` com Postgres, seed e API em background.
- **Primeira execução do CI**: verde nos 3 jobs (backend/typecheck+37 testes, frontend/build, e2e/4 testes).
- A suíte E2E encontrou e motivou o fix de um **bug real**: o cliente enviava `Content-Type: application/json`
  sem corpo e o Fastify respondia 400 em todos os DELETEs da UI.

## Pendências / próximos passos sugeridos
- **Levar à `main`**: a branch já contém o merge da main (com limpeza do node_modules commitado e
  unificação da lineage de migração). Abra o PR e mescle — atenção: o banco do checkout principal
  usa a migração antiga; após atualizar, rode `npx prisma migrate reset` + seed.
- **6.5 Revisão de segurança final** em produção: `NODE_ENV=production` (cookies `secure`),
  segredos fora do repo, backup automatizado do banco.
- Testes de integração ainda usam o banco de dev por padrão (`TEST_DATABASE_URL` opcional já suportado).
- Detecção de conflito de horário na grade (o parser valida SIGAA; falta o realce visual).
