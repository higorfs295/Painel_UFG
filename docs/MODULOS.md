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
| `userView.ts` | `publicUserSelect`, `toPublicUser()` | forma pública canônica do usuário (nunca `passwordHash`) e decifra a matrícula — um único lugar em vez de três |
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
| `auth` | 02/03/04/**17** | `POST /auth/{register, invite/accept, login, refresh, logout, password/forgot}` (rate limit por rota nas de segredo; register gated por `ALLOW_REGISTRATION`) |
| `users` | 01/**21** | `GET/POST /users`, `PATCH /users/:id` (papel/nome), `POST /users/:id/invite`, `POST/DELETE /users/:id/enrollments[/:enrId]`, `DELETE /users/:id` (ADMIN; convites enviados por e-mail quando há SMTP) |
| `courses` | 13/**28** | `GET /courses` (sem os da lixeira), `GET /courses/:slug`, `POST /courses/import` · **lixeira**: `GET /courses/:slug/impact`, `DELETE /courses/:slug`, `GET /courses/trash`, `POST /courses/trash/:id/restore`, `DELETE /courses/trash/:id` (ADMIN; dupla confirmação do slug) |
| `progress` | 05/06/07/**17/19/20** | `GET/POST /me/enrollments`, `PATCH /me/enrollments/:id` (só `startTerm`, `.strict()`), `GET .../progress`, `PUT .../subjects/:id` (APPROVED/ENROLLED/SIMULATED), `GET .../recommendations` |
| `extras` | 08/09 | `GET/POST /me/enrollments/:id/extras`, `PATCH/DELETE /me/extras/:id` |
| `schedules` | 10/11/12/**29** | CRUD de `scenarios`/`disciplines` (valida SIGAA) + `PUT .../paint`; exporta `SigaaError` · **cronograma inteligente**: `GET .../candidates` e `POST .../disciplines/bulk` (aluno informa só o código de horário) |
| `account` | 15/16/**20** | `GET /me` (+período), `PATCH /me/settings`, `POST /me/password`, `GET /me/export`, `POST /me/import` |
| `admin` | **20/21** | `GET /admin/stats` (números agregados) · `GET/POST/DELETE /admin/periods` (calendário) · `GET /admin/config` + `POST /admin/mail/test` (instância/SMTP) |
| `planner` | **25/26** | `GET/POST /me/enrollments/:id/tasks`, `PATCH/DELETE /me/tasks/:id` (agenda) · `GET .../notes`, `PUT/DELETE .../subjects/:sid/note` (anotações) |
| `announcements` | **24** | `GET /announcements` (filtrado por audiência) · `GET/POST/PATCH/DELETE /admin/announcements` |
| `observability` | **27** | `GET /admin/metrics` (p50/p95/p99, rotas, processo, ping do banco) · `GET /admin/audit` (trilha filtrável) |
| `devtools` | — | `POST/DELETE /admin/dev/students`, `POST /admin/dev/announcements` — massa de dados; **só com `DEV_TOOLS=true` fora de produção** |

## Dados e testes

- `prisma/schema.prisma`: 19 entidades + enums; `Course.deletedAt` (lixeira, RF-28); `User` tem `matricula`/`shift` opcionais;
  `AcademicPeriod` guarda o calendário global. `@@unique`/`@@index` nas FKs consultadas
  (`RefreshToken.userId/expiresAt`, `Requisite.subjectId/requiresSubjectId`, `ExtraComponent.enrollmentId`,
  `Scenario.enrollmentId`, `ScenarioDiscipline.scenarioId`, `InviteToken.userId`, `AcademicPeriod.startsAt`).
- `seed/seed.ts`: `importCourse` para a matriz, cria o **admin sem matrícula** (painel@admin.com) e
  itera `students.json` (modelo extensível de contas-aluno: painel@aluno.com de demonstração +
  higor_ferreira@discente.ufg.br com a baseline de `perfil-higor.json`); semeia o calendário exemplo.
  Exige `SEED_ADMIN_PASSWORD`; `SEED_STUDENT_PASSWORD` opcional.
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
├─ pages/                 # 12 páginas (7 do aluno + 7 do admin, contando as compartilhadas)
├─ lib/                   # graph/sigaa/sums (espelho do domínio p/ a grade)
└─ styles/                # index.css — Tailwind v4: @theme (tokens) + base + @layer components
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
| `LoginPage` | `/login` | login + "esqueci a senha" + link para cadastro |
| `RegisterPage` | `/cadastro` | RF-17: auto-registro (autentica na resposta; trata instância fechada/409) |
| `InvitePage` | `/convite/:token`, `/reset/:token` | define a própria senha |
| `OverviewPage` | `/` | mosaico **bento** v5: hero de integralização, donut, composições, callout do próximo marco, stickers, recomendações (só aluno) |
| `SubjectsPage` | `/disciplinas` | tabela com status, filtros e os três estados (Aprovada/**Cursando**/Simular) (só aluno) |
| `ExtrasPage` | `/extras` | CRUD de extras; **3 estados** (planejado/em andamento/concluído) e **categoria reclassificável** por linha (NL→NC/NE/optativa) (só aluno) |
| `SchedulePage` | `/cronograma` | cenários, disciplinas (SIGAA), grade **navegável por teclado** (roving tabindex) + pintura (só aluno) |
| `RecommendationsPage` | `/recomendacoes` | ranking completo do que mais **destrava** (top-3 em destaque + tabela) com marcar-cursando (só aluno) |
| `HelpPage` | `/ajuda` | **Ajuda & sobre** — FAQ das regras (integralização, estados, SIGAA, período); todos os papéis |
| `SettingsPage` | `/config` | nome, **dados acadêmicos** (matrícula/turno), **troca de senha**, tema; p/ aluno também **matrículas** (ingresso) e backup |
| `admin/AdminHomePage` | `/admin` | **visão do sistema**: stat-cards com contadores animados (usuários, **novos 30d**, cursos, atividade), **matrículas por curso**, período vigente + atalhos |
| `admin/AdminUsersPage` | `/admin/usuarios` | criar/convidar, **papel por select**, **matricular/desmatricular**, remover; mostra **matrícula/turno** |
| `admin/AdminCoursesPage` | `/admin/cursos` | catálogo de matrizes + importação (RF-13) + **lixeira** com prazo e restauração (RF-28) |
| `admin/AdminPeriodsPage` | `/admin/periodos` | **calendário acadêmico global**: agenda viradas (TERM/BREAK) + linha do tempo (RF-20 v2) |
| `admin/AdminConfigPage` | `/admin/config` | **configurações da instância**: estado do SMTP + **enviar e-mail de teste**, cadastro público, validade de convite, URL |

Camada de layout **v8 — Tailwind, com o trilho lateral de volta**. A v7 tinha trocado a
barra lateral por uma régua superior e ficou pior; a estrutura voltou a ser a da v6 —
`Sidebar` em gradiente de pôr-do-sol + `Topbar` fina — mas escrita com utilitários Tailwind.
A `Sidebar` é **papel-consciente** (aluno vê a jornada; ADMIN vê a gestão), **colapsável** no
desktop (localStorage `side-collapsed`, 256px → 76px) e vira **gaveta off-canvas com scrim**
abaixo de 1024px. A `Topbar` é a "app bar" do idioma shadcn: translúcida com blur, grudada no
topo, com o curso selecionado, o **chip de período/férias** global (do calendário, via
`GET /me`), o atalho da paleta de comandos e o tema. O ADMIN **não cursa** — `AppLayout` pula
matrícula/`CoursePicker` e as páginas de aluno redirecionam para `/admin`.

## Ferramentas transversais

- `components/CommandPalette.tsx`: paleta **Ctrl/⌘+K** com busca por subsequência, navegação por
  setas e comandos conscientes do papel; `openPalette()` abre de qualquer lugar via evento.
- `lib/csv.ts` + `components/ui/ExportButton.tsx`: exportação CSV com `sep=;` e BOM (abre direto no
  Excel pt-BR). Exporta **as linhas visíveis** — filtro na tela = filtro no arquivo. Usado em
  Histórico, Disciplinas, Agenda e Usuários.
- `components/ui/DangerDialog.tsx`: confirmação em duas etapas (impacto → digitar a palavra-chave)
  para ações destrutivas; hoje serve a lixeira de cursos.
- `components/schedule/SmartFill.tsx`: painel "puxar do meu semestre" (RF-29).

## Estilos e acessibilidade — Tailwind CSS v4

`styles/index.css` é o único arquivo de estilo, em três blocos:

1. **Tokens.** Variáveis cruas por tema (`:root` = escuro, `html[data-theme="light"]` sobrescreve)
   mapeadas em `@theme inline` para tokens semânticos — `--color-background/foreground/card/
   muted/border/primary/ring` — que viram os utilitários `bg-card`, `text-muted-foreground`,
   `border-border`. É a mesma abstração do shadcn/ui, e é o que permite trocar o tema sem
   recompilar. **O `inline` não é decorativo**: sem ele o Tailwind resolve a cor no build e
   utilitários com opacidade (`bg-muted/60`, `border-lock/40`) congelam no valor do tema escuro.
2. **Base.** Reset tipográfico do produto: Sora na interface, Fraunces nos títulos e números,
   foco por `ring` em todo controle, `.skiplink`, barras de rolagem discretas.
3. **`@layer components`.** As classes semânticas que as páginas usam (`.card`, `.row`, `.chip`,
   `.bento`, `.seg`…) construídas com `@apply`. Padrão recomendado do Tailwind para repetição:
   o JSX segue legível e há um lugar só para ajustar cada peça. Componentes novos (casca,
   modais) usam utilitário direto no JSX.

Não há `tailwind.config.js` nem `postcss.config`: na v4 o plugin `@tailwindcss/vite` lê a
configuração do próprio CSS.

- **Design v8**: superfícies com `border + shadow-sm` e raio de 0.75rem, paleta de tokens
  semânticos, foco por anel, escala tipográfica contida. A identidade — cerrado/pôr do sol +
  Fraunces & Sora — permanece; o gradiente do trilho lateral e a **auth imersiva** em tela
  dividida são a assinatura visual que vem desde a v6. Herdados: mosaico **bento**, **marquee**,
  **callout**, contadores animados (`useCountUp`/`CountNum`), **controle segmentado**,
  `Reveal`/IntersectionObserver, esqueletos de carregamento e `prefers-reduced-motion`.
- **Responsividade** pelos breakpoints do Tailwind (sm 640 / lg 1024) e **acessibilidade**
  (`:focus-visible`, `.skiplink`, `.sr-only`, foco navegável na grade de horário).

---

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
