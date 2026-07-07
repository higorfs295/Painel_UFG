# Progresso da Implementação

Registro do que foi implementado e **verificado em execução real** (Node 24 + Postgres em Docker),
seguindo o `ROADMAP.md`. Ordem priorizada: Fases 0 e 1.

## Resumo do estado

| Fase | Descrição | Estado |
| --- | --- | --- |
| **0** | Sanidade do ambiente | ✅ Concluída e verificada |
| **1** | Autenticação ponta a ponta | ✅ Concluída e verificada |
| 2 | Administração de usuários (RF-01) | ✅ Implementada (rotas + validação) |
| 3 | Progresso e domínio no servidor (RF-05/06/07) | ✅ Implementada + testada |
| 4 | Extras / cursos / cronograma (RF-08..13) | ✅ Implementada (falta 4.4 settings/backup) |
| 5 | Frontend funcional | ⬜ Pendente (M2+) |
| 6 | Operação e robustez | ⬜ Pendente |

> As Fases 2–4 do backend já estavam implementadas no commit anterior; o ROADMAP foi gerado de um
> índice antigo que ainda as via como `501/TODO`. Aqui elas foram **verificadas rodando** contra o banco.

## Fase 0 — Sanidade do ambiente ✅

- **0.1 Boot da API** — `npm run dev` sobe na porta 3333; `GET /health` → `{"ok":true}`. Verificado.
- **0.2 Migração e seed** — migration `20260707220537_init` criada e aplicada; `npm run seed` popula
  1 curso (`engcomp-ufg-2021`), 120 disciplinas, a conta `fhigor295@gmail.com` com 23 aprovadas e 9 extras. Verificado.
- **0.3 Testes** — Vitest configurado (`test/unit` sem banco, `test/integration` via `app.inject`).
  **31 testes verdes** (22 unit + 9 integração). `npm test` e `npm run test:integration`.
- **0.4 Erro uniforme** — `setErrorHandler` global em `src/app.ts`: `ZodError`→400 com issues, `OwnershipError`→403/404,
  `SigaaError`→400, erros conhecidos do Prisma (P2002→409, P2025→404), demais→500 genérico (sem stack trace, RNF-04).
- **Typecheck** — `npm run typecheck` (tsc --noEmit) passa sem erros; `requireAuth`/`requireAdmin` tipados (fim dos `any`).

### Correções de ambiente feitas nesta fase
1. **`schema.prisma` inválido** — o esqueleto tinha o cabeçalho e os enums em sintaxe inválida
   (`datasource db { provider=...; url=... }` com `;`, enums numa só linha). Reformatado para sintaxe
   canônica multi-linha. Sem mudança de semântica; a migration reflete as mesmas tabelas.
2. **Carregamento de `.env`** — scripts passam a usar `--env-file=.env` (Node 20+); testes de integração
   carregam via `dotenv` em `test/setup.ts`.
3. **Versões fixadas** — `package.json` do backend com versões do ecossistema Fastify 5 + `package-lock.json` versionado.

### Nota de ambiente da máquina (Avast + TLS)
O antivírus **Avast** intercepta HTTPS. O `npm install` falhava intermitentemente com
`UNABLE_TO_VERIFY_LEAF_SIGNATURE` (retries silenciosos → parecia travar). **Solução segura** (sem
desabilitar verificação): apontar o Node para o CA legítimo do Avast:

```bash
export NODE_EXTRA_CA_CERTS="C:\\ProgramData\\Avast Software\\Avast\\wscert.pem"
```

A variável já existia no sistema, mas com barra dupla no caminho (`Avast\\wscert.pem`), o que fazia o
Node não ler o arquivo. Usar o caminho correto resolve. Considere corrigir a env var do sistema.

## Fase 1 — Autenticação ponta a ponta ✅

Todos os sub-itens implementados e cobertos por teste de integração (`test/integration/auth.test.ts`):

- **1.1** JWT tipado (`declare module "@fastify/jwt"`, payload `{sub, role}`); `requireAuth`/`requireAdmin` como `preHandlerHookHandler`.
- **1.2** Serviço de tokens (`src/lib/crypto.ts`, `invite.ts`, `session.ts`) — token aleatório, guarda só o hash sha256.
- **1.3** `POST /auth/invite/accept` — define senha com argon2, marca `usedAt`; token de uso único (testado: reuso → 400).
- **1.4** `POST /auth/login` — argon2.verify; erro genérico 401 (não revela e-mail vs senha); emite JWT + cookie httpOnly.
- **1.5** `POST /auth/refresh` — rotação a cada uso; reuso de token revogado → revoga a família inteira (testado: 200 → reuso 401 → novo cookie também 401).
- **1.6** `POST /auth/logout` — revoga o refresh e limpa o cookie.
- **1.7** `POST /auth/password/forgot` — reaproveita o fluxo de convite com `purpose=RESET_PASSWORD` (link logado; sem e-mail na v1).
- **1.8** Rate limit por rota — `config.rateLimit` estrito (10/min) em login/invite/forgot; global 120/min.

## Como rodar (verificado)

```bash
# 1) Postgres isolado desta branch (o plugin `docker compose` v2 não está instalado; use docker run):
docker run -d --name painel-lovingnash-db -e POSTGRES_USER=painel -e POSTGRES_PASSWORD=painel \
  -e POSTGRES_DB=painel -p 5432:5432 -v painel_lovingnash_dbdata:/var/lib/postgresql/data postgres:16

# 2) Backend
cd backend
cp .env.example .env        # ajuste JWT_SECRET (há um comando node no arquivo) e SEED_ADMIN_PASSWORD
export NODE_EXTRA_CA_CERTS="C:\\ProgramData\\Avast Software\\Avast\\wscert.pem"   # se estiver atrás do Avast
npm install
npm run migrate             # aplica a migration
npm run seed                # popula curso + sua conta
npm test                    # 22 unit
npm run test:integration    # 9 integração (precisa do banco)
npm run dev                 # http://localhost:3333/health
```

## Pendências e próximos passos

- **Fase 4.4** — `PATCH /me/settings` (tema, RF-15) e `GET /me/export` / `POST /me/import` (backup JSON, RF-16). Ainda não implementados.
- **Testes de integração poluem o banco de dev** — criam usuários/cursos com slugs/e-mails únicos (`*.test.local`)
  e não limpam. Não afetam a sua conta. Melhoria futura: apontar para um `TEST_DATABASE_URL` separado.
- **Fase 5 (frontend)** — próximo alvo natural: fundação do app (router + TanStack Query), telas de Login/Convite
  ligadas à auth já pronta, depois páginas de domínio consumindo a API.
- **Fase 6 (operação)** — Dockerfiles de api/web + serviços no compose, proxy TLS, logs sem dados sensíveis.
