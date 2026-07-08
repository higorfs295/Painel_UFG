# Referência de módulos, arquivos e funções

Mapa do código: o que cada arquivo faz e as funções principais que exporta. Para o desenho geral, ver
[`ARQUITETURA.md`](ARQUITETURA.md); para o contrato HTTP, [`API.md`](API.md).

---

# Backend (`backend/`)

```
src/
├─ server.ts              # bootstrap: listen, shutdown gracioso, expurgo agendado
├─ app.ts                 # fábrica Fastify: plugins + rotas + erro central
├─ env.ts                 # validação de variáveis de ambiente (zod)
├─ plugins/               # segurança, prisma, auth (fastify-plugin)
├─ lib/                   # efeitos isolados (crypto, sessão, convite, posse, backup)
├─ domain/                # lógica pura + pontes Prisma→domínio
├─ modules/<área>/routes.ts   # handlers HTTP por área
└─ seed/                  # seed idempotente + JSONs (matriz, perfil)
prisma/schema.prisma      # modelo de dados + migrations/
test/{unit,integration}/  # Vitest
```

## Núcleo

| Arquivo | Papel | Funções/pontos-chave |
| --- | --- | --- |
| `env.ts` | Carrega e valida env com zod; falha cedo | `env`, `isProd`; campos: `DATABASE_URL`, `JWT_SECRET`(≥32), `REFRESH_EXPIRES_DAYS`, `INVITE_EXPIRES_HOURS`, `APP_URL`, `CORS_ORIGIN`, `RATE_LIMIT_*`, `REDIS_URL?` |
| `app.ts` | Monta a aplicação | `buildApp()`: registra `securityPlugin`→`prismaPlugin`→`authPlugin`, `setErrorHandler` central (Zod/Ownership/Sigaa/Prisma), `/health`, e as rotas por prefixo |
| `server.ts` | Processo | `listen(PORT)`, handlers `SIGINT/SIGTERM`→`app.close()`, `setInterval` diário de `pruneRefreshTokens` (`unref`) |

## Plugins (`src/plugins/`)

| Arquivo | Papel | Detalhes |
| --- | --- | --- |
| `security.ts` | `securityPlugin` | helmet + CORS restrito + rate limit; store **Redis** se `REDIS_URL`, senão memória |
| `prisma.ts` | `prismaPlugin` | instancia `PrismaClient`, `app.decorate("prisma")`, desconecta no `onClose` |
| `auth.ts` | `authPlugin` | registra `@fastify/cookie` e `@fastify/jwt`; decorators `requireAuth`/`requireAdmin` (tipados como `preHandler`); tipagem do payload JWT (`AccessClaims`); `refreshCookieOptions()` (httpOnly, `secure` em prod, `sameSite=lax`, `path=/auth`) |

## Serviços com efeito (`src/lib/`)

| Arquivo | Funções | O que faz |
| --- | --- | --- |
| `crypto.ts` | `generateToken()`, `hashToken()`, `safeEqualHex()` | token opaco base64url (256 bits), hash sha256, comparação em tempo constante |
| `session.ts` | `issueRefreshToken()`, `rotateRefreshToken()`, `revokeRefreshToken()`, `pruneRefreshTokens()` | ciclo do refresh: emite, **rotaciona com claim atômico** (detecta reuso → revoga família), revoga no logout, expurga vencidos/revogados |
| `invite.ts` | `issueInvite()`, `consumeInvite()` | cria token de convite/reset (hash + expiração) e devolve o link; valida (não usado/expirado) |
| `ownership.ts` | `assertEnrollmentOwner()`, `assertExtraOwner()`, `assertScenarioOwner()`, `OwnershipError` | autorização por posse (RNF-05): lança 403/404 se o recurso não é do usuário |
| `backup.ts` | `exportUser()`, `importUser()`, `backupSchema` | monta e restaura (transacional) o backup do usuário, portável por `seq` |

## Domínio (`src/domain/`) — puro, testado

| Arquivo | Funções | O que faz |
| --- | --- | --- |
| `graph.ts` | `statusOf()`, `buildDeps()`, `unlockCount()` | status de disciplina (done/avail/co/lock) a partir de pré/co e marcos; grafo de dependências; destravamento transitivo |
| `sums.ts` | `sums()`, `cappedPct()` | soma horas por composição (NC/NEO/OPT/NL/AC); percentual travado em 100% |
| `sigaa.ts` | `parseSIGAA()`, `conflicts()`, `SLOTS` | parser de código de horário (`"56M23456"`→slots), detecção de conflito |
| `progress.ts` | `computeProgress()`, `recommend()` | agrega composições+status+marcos+projeção; ranqueia recomendações |
| `loadCourse.ts` | `loadCourseGraph()`, `invalidateCourseGraph()` | ponte Prisma→domínio com **cache** por curso (TTL 5 min) |
| `importCourse.ts` | `importCourse()`, `matrizSchema` | importa a matriz numa **transação** (createMany dos requisitos; ignora órfãos); invalida o cache |

## Rotas (`src/modules/<área>/routes.ts`)

Cada função registra os handlers da área. Contrato detalhado em [`API.md`](API.md).

| Módulo | RF | Endpoints |
| --- | --- | --- |
| `auth` | 02/03/04 | `POST /auth/{invite/accept, login, refresh, logout, password/forgot}` (rate limit por rota nas de segredo) |
| `users` | 01 | `GET/POST /users`, `POST /users/:id/invite`, `DELETE /users/:id` (ADMIN) |
| `courses` | 13 | `GET /courses`, `GET /courses/:slug`, `POST /courses/import` |
| `progress` | 05/06/07 | `GET /me/enrollments`, `GET .../progress`, `PUT .../subjects/:id`, `GET .../recommendations` |
| `extras` | 08/09 | `GET/POST /me/enrollments/:id/extras`, `PATCH/DELETE /me/extras/:id` |
| `schedules` | 10/11/12 | CRUD de `scenarios`/`disciplines` (valida SIGAA) + `PUT .../paint`; exporta `SigaaError` |
| `account` | 15/16 | `GET /me`, `PATCH /me/settings`, `GET /me/export`, `POST /me/import` |

## Dados e testes

- `prisma/schema.prisma`: 14 entidades + enums; `@@unique` e `@@index` nas FKs consultadas
  (`RefreshToken.userId/expiresAt`, `Requisite.subjectId/requiresSubjectId`, `ExtraComponent.enrollmentId`,
  `Scenario.enrollmentId`, `ScenarioDiscipline.scenarioId`, `InviteToken.userId`).
- `seed/seed.ts`: usa `importCourse` para a matriz e popula a conta baseline (RF-14); exige
  `SEED_ADMIN_PASSWORD`. JSONs: `matriz-engcomp-2021.json`, `perfil-higor.json`.
- `test/unit/`: domínio + crypto (sem banco). `test/integration/`: rotas via `app.inject` + concorrência
  de sessão (contra Postgres real; `TEST_DATABASE_URL` opcional).

---

# Frontend (`frontend/`)

```
src/
├─ main.tsx               # QueryClientProvider + BrowserRouter
├─ App.tsx                # boot (refresh), guardas de rota, lazy pages, ErrorBoundary
├─ api/                   # client HTTP + endpoints tipados + types
├─ store/                 # Zustand: auth, app
├─ components/{ui,layout} # primitivas e casca; ErrorBoundary
├─ pages/                 # 8 páginas
├─ lib/                   # graph/sigaa/sums (espelho do domínio p/ a grade)
└─ styles/                # theme.css (tokens) + app.css (componentes/animações/responsivo)
```

## Núcleo e dados

| Arquivo | Papel | Pontos-chave |
| --- | --- | --- |
| `main.tsx` | Entrada | `QueryClient` (retry 1, sem refetch no foco), `BrowserRouter` |
| `App.tsx` | Rotas + boot | `auth.bootstrap()` no mount; `RequireAuth`/`RequireAdmin`; `React.lazy` das páginas; `ErrorBoundary` + `Suspense` |
| `api/client.ts` | Fetch base | `api<T>()`: injeta Bearer + credentials; em 401 chama `/auth/refresh` **uma vez** (dedup via promise compartilhada) e repete; `setAccessToken` |
| `api/endpoints.ts` | Chamadas por domínio | objetos `auth`, `me`, `extras`, `courses`, `schedules`, `admin` |
| `api/types.ts` | Tipos das respostas | `User`, `Enrollment`, `Progress`, `Recommendation`, `Extra`, `Scenario`, `AdminUser`, … |
| `store/auth.ts` | Sessão (UI) | `useAuth` (user/status/setSession/clear/patchUser); `applyTheme()` |
| `store/app.ts` | Navegação | `useApp` (enrollment selecionado) |

## Componentes

| Arquivo | Papel |
| --- | --- |
| `components/ui/{Button,Card,Chip}.tsx` | primitivas; `Chip` exporta `StatusChip` (mapeia status→cor) |
| `components/layout/AppLayout.tsx` | casca autenticada: carrega enrollments, skip link, `<main>`, logout |
| `components/layout/{AppHeader,NavTabs,ThemeToggle}.tsx` | header com marca/abas/seletor de curso/tema; abas com `NavLink`; toggle persiste tema via `PATCH /me/settings` |
| `components/ErrorBoundary.tsx` | captura erros de render e mostra fallback amigável |

## Páginas (`src/pages/`)

| Página | Rota | Faz |
| --- | --- | --- |
| `LoginPage` | `/login` | login + "esqueci a senha"; aplica tema no sucesso |
| `InvitePage` | `/convite/:token`, `/reset/:token` | define a própria senha |
| `OverviewPage` | `/` | donut, composições (teto+excedente), marcos, recomendações; estados de erro |
| `SubjectsPage` | `/disciplinas` | tabela com status, filtros e **simulação** (mapeia `seq`→`id` via `courses.detail`) |
| `ExtrasPage` | `/extras` | CRUD de extras; alterna concluído/planejado |
| `SchedulePage` | `/cronograma` | cenários, disciplinas (SIGAA), grade **navegável por teclado** (roving tabindex) + pintura |
| `SettingsPage` | `/config` | tema + exportar/importar backup |
| `AdminPage` | `/admin` | criar/convidar/remover usuários + importar matriz (ADMIN) |

## Estilos e acessibilidade

- `styles/theme.css`: tokens da paleta **cerrado/pôr do sol/povos nativos** em dark e light
  (terra/urucum, ocre, oliva, entardecer, jenipapo) + gradientes (`--sunset`, `--dawnwash`).
- `styles/app.css`: componentes, **animações** (com `prefers-reduced-motion`), **responsividade**
  (breakpoints 820/520px) e **acessibilidade** (`:focus-visible`, `.skiplink`, `.sr-only`, foco da grade).
