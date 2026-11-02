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
| `package.json` | Scripts | `predev` roda `prisma generate` antes do `dev`: o cliente vive em `node_modules` e não acompanha um `git pull`, e um cliente defasado quebra as rotas do campo novo com 500 |
| `server.ts` | Processo | `listen(PORT)`, handlers `SIGINT/SIGTERM`→`app.close()`, `setInterval` diário (`unref`) com `pruneRefreshTokens` + `purgeExpiredCourses` (lixeira, RF-28) |

## Plugins (`src/plugins/`)

| Arquivo | Papel | Detalhes |
| --- | --- | --- |
| `security.ts` | `securityPlugin` | helmet + CORS restrito + rate limit; store **Redis** se `REDIS_URL`, senão memória |
| `performance.ts` | `performancePlugin` | **compressão** (br/gzip, ≥1KB) + **ETag** fraco (revalidação 304) + **under-pressure** (503 com Retry-After sob event loop/heap/RSS travados; expõe `/health/pressure`) |
| `docs.ts` | `docsPlugin` | **OpenAPI 3.1** + Swagger UI em `/docs`; desligado em produção (`DOCS_ENABLED`) |
| `metrics.ts` | `metricsPlugin`, `metricsSnapshot()` | contadores por classe de status, latências p50/p95/p99 (janela deslizante) e agregados por rota; `fp()` p/ valer em toda a app |
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
| `mailer.ts` | `sendInviteEmail()` | RF-18: envia convite/reset via SMTP (nodemailer, lazy); sem `SMTP_HOST` só loga o link; **nunca lança** (fluxo manual continua) |
| `strip.ts` | `stripUndefined()` | remove chaves `undefined` de patches parciais do zod antes do Prisma (`exactOptionalPropertyTypes`) |
| `cache.ts` | `TtlCache` | cache TTL genérico **por processo** com teto de entradas, despejo do mais antigo e `stats` (hits/misses/evictions); `wrap()` nunca memoriza `null` |
| `fieldCrypto.ts` | `encryptField()`, `decryptField()`, `fieldCryptoEnabled` | **camada extra de criptografia**: AES-256-GCM para PII em repouso (matrícula), formato versionado `v1:iv:tag:dados`; sem `FIELD_ENCRYPTION_KEY` opera transparente; valor adulterado → `null` |
| `userView.ts` | `publicUserSelect`, `toPublicUser()` | forma pública canônica do usuário e decifra a matrícula. O mapper **retira** os campos privados (`passwordHash`) em vez de confiar no select do chamador — foi assim que o hash vazava por `/auth/login` e `/auth/register`, que buscavam a linha inteira |
| `errors.ts` | `AppError`, `notFound()`, `badRequest()` | erro de negócio com status HTTP: o serviço sinaliza sem depender de `reply` |
| `schemas.ts` | `idParam`, `paramOf()`, `termString`, `limitQuery()` | primitivos zod compartilhados entre módulos |
| `audit.ts` | `audit()` | RF-27: trilha de auditoria **best-effort** (nunca lança, nunca derruba o fluxo) |

## Domínio (`src/domain/`) — puro, testado

| Arquivo | Funções | O que faz |
| --- | --- | --- |
| `graph.ts` | `statusOf()`, `buildDeps()`, `unlockCount()` | status de disciplina (done/avail/co/lock) a partir de pré/co e marcos; grafo de dependências; destravamento transitivo |
| `sums.ts` | `sums()`, `cappedPct()`, tipos `Minimums`/`CompositionSum` | somas por composição com **contribuição limitada ao mínimo** (raw/counted/excess) — a regra do teto explicada em `DOMINIO.md` §2 |
| `period.ts` | `resolvePeriod()`, `heuristic()`, `TERM_RE` | RF-20 v2: período letivo **global** resolvido do calendário acadêmico agendado (última virada `startsAt<=agora`); sem calendário, `heuristic()` sugere pelo mês |
| `sigaa.ts` | `parseSIGAA()`, `conflicts()`, `SLOTS` | parser de código de horário (`"56M23456"`→slots), detecção de conflito |
| `progress.ts` | `computeProgress()`, `recommend()` | agrega composições+status+marcos+projeção; ranqueia recomendações |
| `loadCourse.ts` | `loadCourseGraph()`, `invalidateCourseGraph()` | ponte Prisma→domínio com **cache** por curso (TTL 5 min) |
| `importCourse.ts` | `importCourse()`, `matrizSchema` | importa a matriz numa **transação** (createMany dos requisitos; ignora órfãos); invalida o cache |

## Arquitetura em camadas (por módulo)

Cada módulo segue a mesma separação — o que torna previsível onde mexer:

```
modules/<área>/
  routes.ts    HTTP: valida entrada (zod) → chama o serviço → devolve. Sem regra de negócio.
  service.ts   Orquestração: posse, banco e chamadas ao domínio. Sem `reply`/`request`.
  schemas.ts   Contrato de entrada em zod, reaproveitável por testes e documentação.
```

O domínio (`src/domain/`) permanece **puro** — sem Prisma, sem HTTP — e por isso é testável
isoladamente. O ganho concreto: os quatro endpoints de progresso repetiam o mesmo preâmbulo
(posse + grafo + status + extras); hoje `loadEnrollmentContext()` faz isso **uma vez**, em
consultas paralelas, e os builders (`buildProgress`/`buildHistory`/`buildAchievements`/
`buildRecommendations`) reaproveitam o mesmo contexto.

| Módulo com serviço | Serviço | Papel |
| --- | --- | --- |
| `progress` | `loadEnrollmentContext()`, `buildProgress/History/Achievements/Recommendations` | contexto único da matrícula + montagem dos agregados |
| `courses` | `listActiveCourses()`, `courseImpact()`, `trashCourse()`, `listTrash()`, `restoreCourse()`, `purgeCourse()`, `purgeExpiredCourses()`, `RETENTION_DAYS` | catálogo e **lixeira** (RF-28): confirmação do slug exigida no servidor, prazo de 7 dias, expurgo manual e automático |
| `schedules` | `scenarioCandidates()`, `bulkAddFromStatuses()`, `suggestSigla()` | **cronograma inteligente** (RF-29): deriva sigla/CH/cor da matriz e só pede o código de horário; recusa `subjectId` fora da matrícula |
| `devtools` | `seedFakeStudents()`, `purgeFakeStudents()` | massa fictícia plausível (uma transação por aluno) |

## Rotas (`src/modules/<área>/routes.ts`)

Cada função registra os handlers da área. Contrato detalhado em [`API.md`](API.md).

| Módulo | RF | Endpoints |
| --- | --- | --- |
| `auth` | 02/03/04/**17/31** | `POST /auth/{register, invite/accept, login, refresh, logout, password/forgot}` (rate limit por rota nas de segredo; register respeita as configurações da instância — aberto/fechado e domínios — com `ALLOW_REGISTRATION` como padrão) |
| `users` | 01/**21/34** | `GET/POST /users` (lista com último login e sessões), `POST /users/import` (lote), `PATCH /users/:id` (papel/nome/matrícula/turno), `POST /users/:id/invite`, `POST /users/:id/sessions/revoke`, `POST/DELETE /users/:id/enrollments[/:enrId]`, `DELETE /users/:id` (ADMIN; convites por e-mail quando há SMTP) |
| `courses` | 13/**28/35** | `GET /courses` (sem os da lixeira), `GET /courses/:slug`, `GET /courses/:slug/export`, `PATCH /courses/:slug`, `POST /courses/import` (`?dryRun=1` = prévia, em `matrix.ts`) · **lixeira**: `GET /courses/:slug/impact`, `DELETE /courses/:slug`, `GET /courses/trash`, `POST /courses/trash/:id/restore`, `DELETE /courses/trash/:id` (ADMIN; dupla confirmação do slug) |
| `progress` | 05/06/07/**17/19/20** | `GET/POST /me/enrollments`, `PATCH /me/enrollments/:id` (só `startTerm`, `.strict()`), `GET .../progress`, `PUT .../subjects/:id` (APPROVED/ENROLLED/SIMULATED), `GET .../recommendations` |
| `extras` | 08/09 | `GET/POST /me/enrollments/:id/extras`, `PATCH/DELETE /me/extras/:id` |
| `schedules` | 10/11/12/**29** | CRUD de `scenarios`/`disciplines` (valida SIGAA) + `PUT .../paint`; exporta `SigaaError` · **cronograma inteligente**: `GET .../candidates` e `POST .../disciplines/bulk` (aluno informa só o código de horário) |
| `account` | 15/16/**20/30** | `GET /me` (+período), `PATCH /me/settings` (tema, cor de destaque, barra lateral — `lib/prefs.ts`), `POST /me/password`, `GET /me/export`, `POST /me/import` |
| `admin` | **20/21/33** | `GET /admin/stats` · `GET /admin/analytics` (Visão do sistema) · `GET /admin/reports/courses/:slug` (agregado; some com < 5 alunos — `analytics.ts`) · `GET/POST/DELETE /admin/periods` (calendário) · `GET /admin/config` + `POST /admin/mail/test` (instância/SMTP) |
| `planner` | **25/26** | `GET/POST /me/enrollments/:id/tasks`, `PATCH/DELETE /me/tasks/:id` (agenda) · `GET .../notes`, `PUT/DELETE .../subjects/:sid/note` (anotações) |
| `announcements` | **24/32** | `GET /announcements` (no ar, por audiência e curso) · `GET/POST/PATCH/DELETE /admin/announcements` (curso-alvo, agendamento, validade, `status`) |
| `settings` | **31** | `GET /settings/public` · `GET/PATCH /admin/settings` (cadastro, domínios, faixa de aviso; `lib/settings.ts` com cache curto) |
| `observability` | **27** | `GET /admin/metrics` (p50/p95/p99, rotas, processo, ping do banco, linha do tempo por minuto) · `GET /admin/audit` (busca, datas, cursor) · `GET /admin/audit/actions` |
| `devtools` | — | `POST/DELETE /admin/dev/students`, `POST /admin/dev/announcements` — massa de dados; **só com `DEV_TOOLS=true` fora de produção** |

## Dados e testes

- `prisma/schema.prisma`: 19 entidades + enums; `Course.deletedAt` (lixeira, RF-28); `User` tem `matricula`/`shift` opcionais;
  `AcademicPeriod` guarda o calendário global. `@@unique`/`@@index` nas FKs consultadas
  (`RefreshToken.userId/expiresAt`, `Requisite.subjectId/requiresSubjectId`, `ExtraComponent.enrollmentId`,
  `Scenario.enrollmentId`, `ScenarioDiscipline.scenarioId`, `InviteToken.userId`, `AcademicPeriod.startsAt`).
- `seed/seed.ts`: `importCourse` para a matriz, cria o **admin** (painel@admin.com; nasce sem matrícula e, desde a v12, pode cursar — o seed não a apaga) e
  itera `students.json` (modelo extensível de contas-aluno: painel@aluno.com de demonstração +
  veterano@aluno.local com a baseline fictícia de `perfil-exemplo.json`); semeia o calendário exemplo.
  Exige `SEED_ADMIN_PASSWORD`; `SEED_STUDENT_PASSWORD` opcional.
- `test/unit/`: domínio + crypto (sem banco). `test/integration/`: rotas via `app.inject` + concorrência
  de sessão (contra Postgres real; `TEST_DATABASE_URL` opcional).

---

# Frontend (`web/`) — Next.js

Aplicação **Next.js 15 (App Router)** + TypeScript + **Tailwind CSS v4**. Desde a v11 o
desenho parte de templates abertos da Tremor (MIT): `template-dashboard` no app,
`template-solar` no site e `template-overview` no login — ver `docs/DESIGN.md` e
`web/THIRD_PARTY_NOTICES.md`.

```
src/
├─ app/                    rotas do App Router
│  ├─ page.tsx             site público (Server Component, template-solar)
│  ├─ (auth)/              entrar · cadastro · convite/[token]  (login do template-overview)
│  ├─ painel/              9 páginas do aluno (inclui mapa/ e avisos/) — o admin também usa (v12)
│  ├─ admin/               10 telas de gestão (visão, usuários, cursos + cursos/[slug], relatórios,
│  │                       avisos, períodos, monitor, auditoria, configurações)
│  ├─ config/ · ajuda/     compartilhadas pelos dois papéis
│  ├─ icon.svg             ícone da aba (a marca)
│  └─ globals.css          tokens + keyframes da Tremor + @layer components
├─ components/
│  ├─ tremor/              componentes Tremor Raw portados (v3→v4, acento = escala brand-*)
│  ├─ fx/                  grafismos e movimento (v12): faixa de topo, anel, contagem, minigráfico,
│  │                       mapa de calor, rosca, faixa de estado, medalha, confete
│  ├─ admin/               peças da gestão (painel, diálogos de convite/CSV/matriz, gaveta do usuário)
│  ├─ layout/              sidebar, gaveta, seletor de curso, perfil, paleta de comandos
│  ├─ overview/            cartões da visão geral (ProgressBar/CategoryBar/ChartCard)
│  ├─ data-table/          DataTable (TanStack) + cabeçalho ordenável + paginação
│  ├─ site/                seções do site público
│  ├─ ui/ · charts/        primitivas das páginas antigas, desenhadas com as classes da Tremor
│  ├─ subject-drawer.tsx   gaveta da disciplina (requisitos, libera, marcações, anotação)
│  └─ schedule/            "puxar do meu semestre" (RF-29)
├─ hooks/                  use-progress (queryKey centralizadas) · use-announcements
└─ lib/                    api · auth-store · appearance · palette · audit-labels · csv(-parse) ·
                           curriculum-graph · chart-utils · sigaa · utils
e2e/                       Playwright (smoke + fluxos + visual)
```

## Núcleo

| Arquivo | Papel | Pontos-chave |
| --- | --- | --- |
| `app/layout.tsx` | casca HTML | `next/font` auto-hospeda Inter (app) e Geist (site); `<Providers>`; `suppressHydrationWarning` por causa do next-themes |
| `components/providers.tsx` | provedores do cliente | next-themes (`defaultTheme="system"`, claro forçado em `/`) + QueryClient + bootstrap de sessão + Toaster |
| `lib/api/client.ts` | HTTP | access token em memória, refresh único compartilhado em 401, `ApiError` com status |
| `lib/api/session-hint.ts` | marca local | evita um POST `/auth/refresh` inútil (e um 401 no console) para quem nunca teve sessão |
| `lib/auth-store.ts` | Zustand | `status: loading \| in \| out` (sem isso um F5 pisca a tela de login) e a matrícula selecionada |
| `components/layout/app-shell.tsx` | casca autenticada | guarda de rota (aluno não entra em /admin; admin entra em /painel — v12); escolha de curso (RF-17) só quando a lista VEIO vazia — erro de rede/429 mostra "tentar novamente"; faixa de aviso da instância; entrada suave por rota |
| `lib/appearance.ts` | aparência (v12) | `data-accent`/`data-sidebar` no `<html>`, script do `<head>` contra o "pisca em laranja", sincronização com a conta |
| `lib/palette.ts` | cores com significado (v12) | situação, composição, tipo de tarefa e público de aviso — fixas; `solid` para texto sobre cor |
| `components/layout/nav-data.ts` | mapa de navegação | dado, não JSX — sidebar, gaveta e paleta leem a MESMA fonte; `navFor(papel, rota)` troca a lista do admin entre gestão e "Meu painel" |
| `hooks/use-progress.ts` | dados do aluno | `keys` centralizadas; `useSetSubject` invalida progresso, recomendações, histórico e conquistas de uma vez; `useNotes`/`useSaveNote` (RF-26) |
| `hooks/use-announcements.ts` | avisos | feed + marcador "não lido" no navegador (contador na sidebar, página `/painel/avisos`) |
| `lib/curriculum-graph.ts` | topologia da matriz | requisitos/liberadas por disciplina, profundidade (maior cadeia de PRÉ, protegida contra ciclo) e fecho transitivo para o mapa e a gaveta |

## Componentes

| Grupo | O que tem |
| --- | --- |
| `tremor/` | Button, Badge, Divider, Label, Input, Checkbox, Dropdown, Drawer, Dialog, TabNavigation, Table, ProgressBar, ProgressCircle, LineChart/AreaChart/BarChart (recharts), BarList, CategoryBar, Searchbar, CommandBar, Switch, Textarea, Tabs, Accordion, Tooltip, RadioCardGroup |
| `fx/` | `PageBanner`, `DotField`, `ProgressRing`, `CountUp`, `Sparkline`, `Heatmap`, `Donut`/`DonutLegend`, `Tracker`, `StatTile`, `Medal`, `EmptyArt`, `fireConfetti` |
| `admin/` | `Panel`/`Pill`, `UserDrawer`/`Avatar`, `InviteDialog`, `ImportUsersDialog`, `CourseImportDialog` |
| `layout/` | `Sidebar` (fixa em `lg`, barra superior + `MobileSidebar` abaixo), `CourseSwitcher*`, `UserProfile*` (tema salvo na conta), `NavLinks`, `CommandPalette` |
| `overview/` | `ProgressBarCard`, `CategoryBarCard`, `ChartCard` |
| `data-table/` | `DataTable` (seleção por clique, filete na linha selecionada, barra de lote), `DataTableColumnHeader` (botão ordenável), `DataTablePagination` |
| `site/` | `NavBar`, `Hero` + `GameOfLife`, `Features` (+ `Orbit`, `ChipViz`), `RuleQuote`, `CurriculumMap`, `Analytics` (+ `StickerCard`), `CallToAction`, `Footer` |
| `ui/` | API antiga (`Card`, `Section`, `PageHead` — que agora desenha a `PageBanner`, `StatCard`, `Chip`/`StatusChip`, `Badge`, `Bar`, `Segmented`, `Field`, `inputCls`/`selectCls`, `DataTable` por colunas-dado, `ExportButton`, `DangerDialog` sobre o Dialog da Tremor, ícones Remix) |
| `charts/` | `ChartTitle`, `MetricCard`, `DonutProgress` (ProgressCircle), `BarList`, `StackedBar` |

O `DataTable` de `ui/` recebe as colunas como dado (`header`/`cell`/`value`): a mesma definição
renderiza a tabela e alimenta o CSV, então filtro na tela é filtro no arquivo.

## Estilos

`app/globals.css`: variáveis por tema (`:root` claro, `.dark` escuro) apontando para os cinzas
do Tailwind usados pela Tremor → `@theme inline` com os tokens semânticos → `@theme` com as
animações dos componentes Radix → `@layer base/components` → keyframes do site. Sem
`tailwind.config.js`.

**O `inline` do `@theme` não é decorativo**: sem ele o Tailwind resolve a cor no build e todo
utilitário com opacidade (`bg-muted/60`) congela no valor de um dos temas.

# Anatomia de uma requisição (rastreamento completo)

Para fixar como as peças conversam, o caminho exato de `GET /me/enrollments/:id/progress` —
da tecla F5 ao JSON na tela:

1. **`OverviewPage`** monta → `useQuery(["progress", enrollmentId])` chama
   `me.progress()` (`api/endpoints.ts`), que delega a `api()` (`api/client.ts`).
2. **`api/client.ts`** injeta `Authorization: Bearer <token em memória>` e `credentials:include`.
   Se o token expirou, o 401 dispara **um** `POST /auth/refresh` (deduplicado entre chamadas
   concorrentes por uma promise compartilhada) e repete a requisição original.
3. No servidor, a requisição atravessa os **plugins** na ordem de registro:
   `securityPlugin` (helmet → CORS → rate limit por IP) → `authPlugin.requireAuth`
   (verifica o JWT; popula `req.user = { sub, role }`).
4. **`modules/progress/routes.ts`**: zod valida `:id` → `assertEnrollmentOwner(prisma, id,
   req.user.sub)` (`lib/ownership.ts`) resolve a matrícula e lança `OwnershipError` 403/404 se
   não for do usuário.
5. **`domain/loadCourse.ts`**: `loadCourseGraph(courseId)` — *cache hit* (TTL 5 min) devolve o
   grafo pronto; *miss* faz UMA query com `include` (disciplinas + requisitos + composições +
   marcos) e converte ids→`seq` para as formas puras do domínio.
6. Duas queries paralelas (`Promise.all`): `SubjectStatus` (com o `seq` de cada disciplina) e
   `ExtraComponent` da matrícula.
7. **`domain/progress.ts`**: `computeProgress()` — monta os conjuntos `approved`/`projected`,
   chama `sums()` duas vezes (oficial e projeção, com os mínimos de `minimumsFrom()`), calcula
   `statusOf()` por disciplina e o estado dos marcos. **Zero I/O** neste passo.
8. A rota devolve o agregado; em erro, o `setErrorHandler` central (`app.ts`) já teria mapeado
   Zod→400 / Ownership→403/404 / Prisma→409/404 / resto→500 sem stack.
9. De volta no cliente, o TanStack Query guarda em cache por `queryKey`; as **mutações**
   (`PUT .../subjects/:id`, extras, etc.) invalidam `["progress", id]` e `["recs", id]` — a UI
   re-renderiza com os números novos sem gestão manual de estado.

Variação de escrita (`PUT .../subjects/:subjectId`): passos 1–4 iguais; o handler valida que a
disciplina pertence ao curso da matrícula, faz `upsert`/`deleteMany` do `SubjectStatus` e
responde — o recálculo do progresso acontece na **próxima leitura** (nada é materializado; com
~10² disciplinas o cálculo puro custa microssegundos, e é por isso que não há coluna "total"
para dessincronizar).
