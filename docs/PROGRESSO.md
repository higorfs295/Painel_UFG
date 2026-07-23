# Progresso da Implementação

## Design v4 — "Cerrado dashboard" (2026-07-10)

Reforma **estrutural** do frontend, mesclando de verdade os 5 templates de referência (Luminary,
NovaPay, Quantix, Frost, Crypto Vault) sobre a identidade cerrado/pôr do sol (paleta preservada):

- **Trilho lateral de dashboard** (Crypto Vault): sidebar de vidro com marca, navegação por ícones
  de traço fino (desenhados à mão em `ui/Icons.tsx`), item ativo com acento de urucum e cartão do
  usuário com avatar+saída; no mobile vira faixa superior rolável (sem overflow — verificado).
- **Topbar de conteúdo**: curso ativo, chip de período/férias e tema, com fio de poente animado.
- **Hero de estatísticas** (NovaPay): 4 cartões com ícone, número grande em Fraunces com gradiente
  (horas integralizadas, concluídas, disponíveis, horas até o próximo marco) e anel pulsante no hover.
- **Ticker "Próximos passos"** (NovaPay/Frost): marquee vivo com as recomendações (pausa no hover,
  some em reduced-motion).
- **Auth em tela dividida** (Quantix/Luminary): hero editorial com manchete Fraunces gigante,
  sol desfocado flutuando, bullets com ícones; formulário em painel de vidro.

- **Tipografia com alma**: Fraunces (display serifada orgânica, títulos com itálico de destaque)
  + Sora (interface) — carregadas de forma **não-bloqueante** (fallback elegante se a CDN falhar).
- **Grão de filme** (`feTurbulence` em overlay fixo) — a textura sutil que tira o "liso digital".
- **Painéis de vidro**: cartões translúcidos com `backdrop-blur`, bordas fio-de-cabelo e fio de
  luz no topo; tabelas sem "gaiola" (só linhas de ar).
- **Movimento "silk"** (`cubic-bezier(0.16,1,0.3,1)`): entradas suaves, hovers com elevação,
  shimmer nas barras, sol flutuando no horizonte das telas de entrada.
- **Editorial**: micro-labels em caixa alta espaçada (h3 com traço de urucum), nav em pílulas,
  botões-pílula com gradiente de poente, horizonte + sol decorativos no login/cadastro.
- Acessibilidade preservada (focus-visible, reduced-motion desliga inclusive o grão).

**Batismo em 1 linha (`frontend/src/branding.ts`)**: `APP_NAME` (e `APP_TAGLINE`) propagam para
cabeçalho, login/cadastro/convite, título da aba e tela de erro — renomear o sistema é editar uma
constante.

---


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

## Escala da gestão acadêmica (RF-22..27) — feito
- **Domínio novo e puro**: `history.ts` (histórico por período, **MGA ponderada por CH**, ritmo e
  estimativa de formatura) e `achievements.ts` (14 conquistas derivadas, nunca persistidas).
- **Dados**: `SubjectStatus` ganhou `grade`/`absences`; novos `Announcement`, `StudyTask`,
  `SubjectNote` e `AuditLog` (19 entidades no total).
- **Módulos**: `planner` (agenda + anotações), `announcements` (feed por audiência),
  `observability` (métricas + auditoria) e `devtools` (massa de dados, tripla trava).
- **Observabilidade**, que era o maior vazio para publicar: `/admin/metrics` (p50/p95/p99, status
  por classe, rotas mais usadas/lentas, memória, ping do banco) e `/admin/audit` (trilha
  filtrável). Painel **Monitor** consome os dois.
- **Sessões ativas** visíveis e revogáveis sem expor token nem hash.
- Frontend: páginas Histórico, Agenda, Monitor e Avisos.

## Refatoração de arquitetura — feito
- **Camadas por módulo**: `routes` (HTTP fino) / `service` (orquestração) / `schemas` (zod), com o
  domínio seguindo puro. `loadEnrollmentContext()` eliminou a duplicação do preâmbulo nos quatro
  endpoints de progresso (posse + grafo + status + extras), agora em consultas paralelas.
- **Componentização**: `lib/userView.ts` (forma pública do usuário, antes duplicada em três rotas),
  `lib/errors.ts` (`AppError`), `lib/schemas.ts` (primitivos zod) e `lib/cache.ts` (TtlCache com
  teto/despejo/stats, que substituiu o cache ad-hoc do `loadCourse`).
- **Camada extra de criptografia**: cifra de campo AES-256-GCM (`v1:iv:tag:dados`) para a matrícula
  em repouso, aplicada em todas as bordas; sem chave opera transparente (retrocompatível).
- **Escala/desempenho**: compressão br/gzip, ETag (304), `under-pressure` (503 + `Retry-After`,
  `/health/pressure`) e **OpenAPI 3.1 + Swagger UI em `/docs`** (fora de produção). Índices novos
  em `Announcement(audience,pinned,createdAt)` e `AuditLog(userId)`.
- **Animações**: entrada de rota, cascata, esqueletos e pulso — desligadas por `prefers-reduced-motion`.
- Estado dos testes ao final desta etapa: **43 unitários + 42 de integração + 6 E2E**, CI verde nos 3 jobs.

## Lixeira, cronograma inteligente e redesign v7 (RF-28/29) — feito
- **Lixeira de cursos (RF-28)**: apagar um curso levava, em cascata, matrículas e progresso de todo
  mundo. Agora a exclusão tem duas etapas — `Course.deletedAt` (some do catálogo, não aceita
  matrícula nova, dados intactos) e expurgo definitivo — cada uma exigindo que o **slug seja
  redigitado e reenviado ao servidor**. Passados 7 dias (`RETENTION_DAYS`), o job diário do
  `server.ts` faz o expurgo sozinho. Restauração num clique; tudo na auditoria.
- **Cronograma inteligente (RF-29)**: montar a grade era redigitar nome, sigla, CH e cor de
  disciplinas que já estavam cadastradas. `GET /me/scenarios/:sid/candidates` devolve as que estão
  como **cursando/simulada** já com essas sugestões derivadas da matriz, e o `bulk` insere pedindo
  só o **código de horário** do SIGAA. O `subjectId` vem do cliente e por isso é revalidado: fora da
  matrícula, 400.
- **Ferramentas nas páginas**: paleta de comandos **Ctrl/⌘+K** (busca por subsequência, consciente
  do papel), **exportação CSV** do que está na tela (Histórico, Disciplinas, Agenda, Usuários — com
  `sep=;` e BOM para abrir direto no Excel pt-BR), filtro por **núcleo** em Disciplinas, filtros de
  **urgência/tipo** na Agenda, filtro por **papel/convite** em Usuários e período no Histórico.
- **Design v7 — "impresso do cerrado"**: a barra lateral em gradiente e o app-card flutuante deram
  lugar a um **trilho superior tipográfico** e a conteúdo em **tela cheia**; superfícies chapadas
  separadas por réguas de 1px, cantos de 3–6px (eram 22–32), manchetes até 4.2rem e números de
  estatística em Fraunces. A identidade (paleta cerrado/poente + Fraunces/Sora) ficou intacta.
- **Bug real encontrado pelo E2E**: com mais de um cenário, um efeito reescrevia `activeId` a partir
  de uma lista ainda desatualizada logo após criar — e o "Excluir" apagava o cenário errado. O
  estado agora guarda só a escolha explícita, com fallback calculado na renderização.
- Estado dos testes: **43 unitários + 58 de integração + 6 E2E**.

## Design v8 — Tailwind CSS v4 e a volta do trilho lateral — feito
- **A v7 foi rejeitada**: o trilho superior com conteúdo em tela cheia ficou pior que a v6. A
  estrutura voltou a ser a da v6 (sidebar em gradiente + app bar fina), mas reimplementada.
- **Tailwind CSS v4** entrou via `@tailwindcss/vite` — sem `tailwind.config.js`, sem `postcss.config`:
  o tema vive no próprio CSS. `theme.css` e `app.css` (≈1.000 linhas de CSS à mão) deram lugar a um
  único `styles/index.css`.
- **Tokens semânticos** no idioma shadcn/ui (`background/foreground/card/muted/border/primary/ring`),
  com as cores do cerrado por trás. Duas camadas: variáveis cruas por tema + `@theme inline`.
- **Gotcha que custou tempo**: sem o `inline` no `@theme`, o Tailwind resolve a cor no build e todo
  utilitário com opacidade (`bg-muted/60`, `border-lock/40`) congela no valor do tema escuro — o
  tema claro fica pela metade. Vale registrar porque o sintoma (só *algumas* cores não trocam) não
  aponta para a causa.
- **Outra armadilha, essa de diagnóstico**: o painel de navegação embutido devolvia estilo computado
  em cache para `html`/`body`, sugerindo um bug de tema que não existia. Confirmado num navegador
  real (Playwright) que o fundo troca corretamente nos dois temas.
- As páginas não foram reescritas: as classes semânticas (`.card`, `.chip`, `.bento`…) continuam,
  agora montadas com `@apply` em `@layer components` — o padrão que o próprio Tailwind recomenda
  para repetição. Casca, modais e paleta usam utilitário direto no JSX.
- CSS final: **74 KB** (~11 KB gzip) contra ~1.000 linhas de CSS manual antes.

## Pendências / próximos passos sugeridos
- **Frontend será substituído** — o backend e o contrato (`/docs`) estão prontos para servir a
  nova interface sem alteração.
- `ALLOW_REGISTRATION` ainda vem do ambiente; torná-lo editável em runtime exigiria movê-lo para
  o banco (a tela de Configurações hoje só o exibe).
- A estimativa de formatura oscila com histórico curto — considerar esconder abaixo de N períodos.
- Detecção de conflito de horário na grade (o parser valida SIGAA; falta o realce visual).
- Cache é **por processo**: com várias réplicas, migrar o `TtlCache` para Redis (a interface já
  isola essa troca).
