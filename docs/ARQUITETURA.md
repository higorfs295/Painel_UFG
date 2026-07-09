# Arquitetura — Painel Acadêmico

Documento de arquitetura com diagramas, decisões de projeto e o mapa de camadas. Complementado por
[`API.md`](API.md) (contrato de endpoints com exemplos) e [`MODULOS.md`](MODULOS.md) (referência
arquivo a arquivo / função a função). Requisitos em [`../ESPECIFICACAO.md`](../ESPECIFICACAO.md).

---

## 1. Visão geral

O Painel Acadêmico acompanha a integralização de matrizes curriculares: calcula o status de cada
disciplina a partir do grafo de pré/co-requisitos e marcos de horas, recomenda disciplinas pelo impacto
de destravamento, registra componentes fora da matriz e monta cenários de cronograma. É multiusuário,
com papéis ADMIN/USER, e escalável para múltiplos cursos.

A regra de ouro do projeto: **o cliente é conveniência; todo cálculo que concede algo (posse, papel,
status, validação de código SIGAA) é reexecutado no servidor**.

## 2. Componentes e topologia

```mermaid
flowchart LR
  User([Usuário])
  subgraph Cliente
    SPA["React SPA<br/>Vite · TanStack Query · Zustand"]
  end
  subgraph Edge["Borda (produção)"]
    Caddy["Caddy<br/>TLS · proxy · headers de segurança"]
    Nginx["nginx<br/>estáticos do SPA"]
  end
  subgraph Servidor
    API["API Fastify<br/>rotas · domínio puro · Prisma"]
  end
  DB[("PostgreSQL")]
  Redis[("Redis<br/>(opcional)")]

  User -->|HTTPS| Caddy
  Caddy -->|"/auth /me /users /courses /health"| API
  Caddy -->|"/* (SPA)"| Nginx
  Nginx --> SPA
  SPA -.->|"fetch (mesma origem)"| Caddy
  API -->|Prisma| DB
  API -.->|"rate limit distribuído"| Redis
```

- **Mesma origem**: o Caddy roteia as rotas de API para o backend e todo o resto para o SPA. Assim o
  cookie de refresh (`path=/auth`) casa e não há CORS em produção.
- **Dev**: SPA em `:5173` (Vite) e API em `:3333` (Fastify) com CORS restrito; Postgres em Docker.
- **Redis é opcional**: sem `REDIS_URL` o rate limit é em memória (suficiente para 1 réplica).

## 3. Ciclo de vida de uma requisição

Toda rota autenticada passa pela mesma cadeia de guardas antes do handler:

```mermaid
flowchart TD
  Req([Requisição]) --> Sec["securityPlugin<br/>helmet · CORS · rate limit"]
  Sec --> Auth{"requireAuth / requireAdmin"}
  Auth -->|401 / 403| ErrH
  Auth -->|ok| Zod["validação zod do payload"]
  Zod -->|inválido| ErrH["erro central (setErrorHandler)"]
  Zod --> Own{"posse do recurso?<br/>assertEnrollmentOwner / ..."}
  Own -->|403 / 404| ErrH
  Own --> H["handler<br/>domínio puro + Prisma"]
  H -->|sucesso| Resp([JSON])
  H -->|throw| ErrH
  ErrH --> Resp2([JSON de erro sem stack])
```

O `setErrorHandler` central mapeia `ZodError→400`, `OwnershipError→403/404`, `SigaaError→400`,
erros conhecidos do Prisma (`P2002→409`, `P2025→404`) e o resto para `500` genérico (RNF-04).

## 4. Camadas do backend

O backend separa **lógica de domínio pura** (testável sem banco) de **efeitos** (rotas HTTP e acesso a
dados). Essa é a decisão estrutural mais importante — o servidor é a fonte de verdade dos cálculos.

```mermaid
flowchart TD
  subgraph HTTP
    R["modules/*/routes.ts<br/>Fastify + zod + posse"]
  end
  subgraph Domínio["domain/ (puro, testado)"]
    G["graph.ts — status e destravamento"]
    S["sums.ts — somas com teto 100%"]
    P["progress.ts — computeProgress / recommend"]
    SI["sigaa.ts — parser de horário"]
    L["loadCourse.ts — Prisma→domínio + cache"]
    I["importCourse.ts — matriz→banco (tx)"]
  end
  subgraph Serviços["lib/ (efeitos isolados)"]
    C["crypto · session · invite · backup · ownership"]
  end
  R --> Domínio
  R --> Serviços
  L --> PR[("Prisma")]
  I --> PR
  Serviços --> PR
  R --> PR
```

- `domain/graph.ts`, `sums.ts`, `sigaa.ts`, `progress.ts` **não importam Prisma nem HTTP** — recebem
  formas simples e são cobertos por testes unitários rápidos.
- `loadCourse.ts` é a ponte Prisma→domínio (com cache em memória por curso, TTL 5 min).
- `lib/*` concentra os efeitos com segredo (hash de tokens, rotação de refresh, backup).

## 5. Fluxo de autenticação (RF-01..04)

Access token JWT curto (~15 min) no header `Authorization`; refresh opaco, rotativo, em cookie
`httpOnly`. Só o **hash** dos tokens é persistido (RNF-01).

```mermaid
sequenceDiagram
  actor Admin
  participant B as Navegador SPA
  participant A as API
  participant DB as Postgres

  Admin->>A: POST /users {nome,email}
  A->>DB: cria User(passwordHash=null) + InviteToken(hash)
  A-->>Admin: link /convite/{token}
  Note over B: usuário abre o link
  B->>A: POST /auth/invite/accept {token, senha}
  A->>DB: valida hash+expiração, grava argon2(senha), marca usedAt
  A-->>B: 204

  B->>A: POST /auth/login {email, senha}
  A->>DB: argon2.verify + cria RefreshToken(hash)
  A-->>B: 200 {accessToken} + Set-Cookie rt (httpOnly)

  Note over B,A: acesso expira → renovação transparente
  B->>A: POST /auth/refresh (cookie rt)
  A->>DB: claim atômico updateMany(revokedAt:null)
  alt claim vence
    A->>DB: cria novo RefreshToken (rotação)
    A-->>B: 200 {accessToken} + novo rt
  else token já revogado (reuso/vazamento)
    A->>DB: revoga toda a família do usuário
    A-->>B: 401 reason=reuse
  end
```

O "claim" atômico (`updateMany where revokedAt=null`) garante que sob dois refresh concorrentes com o
mesmo token apenas **um** vença — fechando a corrida de rotação e a proliferação de tokens.

## 6. Modelo de dados (14 entidades)

```mermaid
erDiagram
  User ||--o{ InviteToken : possui
  User ||--o{ RefreshToken : possui
  User ||--o{ Enrollment : matricula
  Course ||--o{ CompositionRequirement : define
  Course ||--o{ Milestone : define
  Course ||--o{ Subject : contém
  Course ||--o{ Enrollment : recebe
  Subject ||--o{ Requisite : "requer (pre/co)"
  Subject ||--o{ SubjectStatus : "status por aluno"
  Enrollment ||--o{ SubjectStatus : registra
  Enrollment ||--o{ ExtraComponent : registra
  Enrollment ||--o{ Scenario : possui
  Scenario ||--o{ ScenarioDiscipline : contém
  Scenario ||--o{ ScenarioPaint : contém

  User {
    string id PK
    string email UK
    string passwordHash "null até o convite"
    Role role
    string theme
  }
  Course {
    string slug UK
    int totalHours
  }
  Subject {
    int seq "nº na matriz"
    string code
    Nucleus nucleus "NC|NE"
    int groupOpt "0=obrig; 2..5=optativa"
  }
  SubjectStatus {
    SubjectState state "APPROVED|SIMULATED"
  }
  ExtraComponent {
    ExtraCategory category "OPT|NL|AC|NONE"
    bool done "planejado não soma"
  }
  RefreshToken {
    string tokenHash UK
    datetime revokedAt "rotação/revogação"
  }
```

Modelar composições (NC/NEO/OPT/NL/AC) e marcos (CH1..CH3) como **linhas** — não colunas fixas — é o
que permite cursos com estruturas diferentes (RF-13). Requisitos apontam para uma disciplina (por id) ou
para uma `milestoneKey` (requisito por horas). Índices em todas as FKs consultadas (ver `MODULOS.md`).

## 7. Cálculo de progresso (RF-05/06/07)

O coração do produto. Dado o grafo do curso e os status do aluno:

```mermaid
flowchart LR
  subgraph Entrada
    Subj["disciplinas + requisitos"]
    St["status (APPROVED/SIMULATED)"]
    Ex["extras (done?)"]
  end
  Subj --> CP["computeProgress()"]
  St --> CP
  Ex --> CP
  CP --> Comp["composições c/ teto 100% + excedente"]
  CP --> Stat["status por disciplina (done/avail/co/lock)"]
  CP --> Mile["marcos CH1..CH3 (atingidos?)"]
  CP --> Proj["projeção (inclui SIMULATED)"]
  Subj --> RC["recommend()"]
  St --> RC
  RC --> Rank["ranking por destravamento transitivo<br/>(obrigatórias primeiro)"]
```

- **Teto em 100% com excedente registrado** (RF-05): as barras travam em 100%, mas o valor real é
  preservado e exibido como "+Xh além do mínimo".
- **Oficial × simulado** (RF-06): `APPROVED` conta no oficial; `SIMULATED` só na projeção.
- **Recomendações** (RF-07): para cada disciplina disponível, conta quantas outras ela destrava
  transitivamente no grafo, priorizando obrigatórias.

## 8. Estrutura do frontend

```mermaid
flowchart TD
  main["main.tsx<br/>QueryClient + Router"] --> App
  App["App.tsx<br/>boot (refresh) + guardas + lazy routes"] --> Layout["AppLayout<br/>enrollments + &lt;main&gt;"]
  App --> Auth["LoginPage · InvitePage"]
  Layout --> Pages["Overview · Subjects · Extras · Schedule · Settings · Admin"]
  Pages --> Q["api/endpoints (TanStack Query)"]
  Pages --> UI["components/ui · layout"]
  Q --> Client["api/client<br/>JWT em memória + refresh em 401"]
  App --> Store["store/{auth,app} (Zustand)"]
```

- **Sessão**: access token em memória (`api/client.ts`); refresh transparente uma vez em qualquer 401.
- **Estado de servidor**: TanStack Query (cache por `queryKey`, invalidação nas mutações).
- **Estado de UI**: Zustand (`auth` = usuário/status; `app` = enrollment selecionado).
- **Code-splitting**: cada página autenticada é um chunk (`React.lazy`).
- **Tema**: `html[data-theme]` alternado e persistido por usuário (RF-15).

## 9. Decisões de projeto (resumo)

| Decisão | Porquê |
| --- | --- |
| Domínio puro separado das rotas | Servidor como fonte de verdade; testes rápidos sem banco; espelha `frontend/src/lib`. |
| Refresh rotativo + detecção de reuso | Sessão longa segura; vazamento de cookie é detectado e revoga a família. |
| Composições/marcos como linhas | Multi-curso (RF-13) sem alterar schema por curso. |
| Cache do grafo por curso | Matriz é imutável entre importações; evita recarregar ~10² linhas por request. |
| Cookie `httpOnly` + JWT em memória | Access token não fica em `localStorage` (mitiga XSS); refresh não é acessível por JS. |
| Backup portável por `seq` | Sobrevive a re-seed/reimportação da matriz (ids mudam, `seq` não). |

## 10. Deploy (Compose + Caddy)

O `docker-compose.yml` descreve a stack completa. O Caddy é o único serviço com portas públicas
(80/443); API e web só são alcançáveis pela rede interna do Compose (`expose`, sem `ports`).

```mermaid
flowchart TB
  Internet([Internet]) -->|":80 / :443 (TLS)"| Caddy

  subgraph Host["Host Docker — rede interna do Compose"]
    Caddy["caddy:2<br/>TLS automático · headers de segurança<br/>volumes: Caddyfile (ro), caddydata, caddyconfig"]
    Web["web (nginx:1.27-alpine)<br/>build: frontend/Dockerfile (Vite → estáticos)<br/>fallback SPA · expose :80"]
    Api["api (node:22-bookworm-slim)<br/>build: backend/Dockerfile (multi-stage, não-root)<br/>entrypoint: migrate deploy → node dist/server.js<br/>expose :3333"]
    Db[("db (postgres:16)<br/>healthcheck pg_isready<br/>volume dbdata")]
  end

  Caddy -->|"/auth /me /users /courses /health"| Api
  Caddy -->|"/* (SPA)"| Web
  Api -->|"DATABASE_URL (rede interna)"| Db
  Api -.->|"espera healthcheck<br/>(depends_on: service_healthy)"| Db
```

Sequência de subida e pontos de atenção:

1. **`db`** sobe primeiro; o healthcheck (`pg_isready`) segura a API até o Postgres aceitar conexões.
2. **`api`** roda `prisma migrate deploy` no entrypoint (aplica migrações pendentes, nunca cria novas)
   e então inicia o servidor; encerra graciosamente em `SIGTERM` (drena requests, desconecta o Prisma).
3. **`web`** é só nginx servindo o build do Vite com fallback para `index.html` (BrowserRouter).
4. **`caddy`** termina TLS (interno em `localhost`; Let's Encrypt automático com domínio real),
   injeta os headers de segurança (HSTS/CSP/XFO) e roteia por caminho — mesma origem, sem CORS.

```bash
cp .env.example .env            # defina JWT_SECRET (e POSTGRES_PASSWORD em produção)
docker compose up --build -d
docker compose run --rm -e SEED_ADMIN_PASSWORD='...' api npm run seed   # 1ª vez
docker compose logs -f api     # acompanhar migrações/boot
```

Backup do banco em produção: `docker compose exec db pg_dump -U painel painel > backup.sql`
(agendar via cron; o volume `dbdata` persiste os dados entre recriações de container).

## 11. Deploy custo-zero (Render + Vercel + Neon)

A alternativa hospedada sem servidor próprio — passo a passo operacional em
[`DEPLOY.md`](DEPLOY.md); aqui, a topologia e o que muda arquiteturalmente:

```mermaid
flowchart LR
  User([Usuário]) -->|HTTPS| Vercel
  subgraph Vercel["Vercel (free) — CDN global"]
    SPA["SPA estático (build Vite)<br/>VITE_API_URL embutida no build<br/>vercel.json: SPA rewrites + headers"]
  end
  SPA -->|"fetch cross-site<br/>Authorization: Bearer + cookie SameSite=None"| Render
  subgraph Render["Render (free) — hiberna s/ tráfego"]
    API2["painel-api (render.yaml)<br/>start: migrate deploy → node dist<br/>healthCheckPath /health"]
  end
  Render -->|"DATABASE_URL (pooled, pgbouncer=true)"| Neon
  Render -.->|"DIRECT_URL (só migrações)"| Neon
  subgraph Neon["Neon (free permanente)"]
    PG[("Postgres 16<br/>pooler embutido · autosuspend ~1s")]
  end
  Ping["UptimeRobot (opcional)"] -.->|"GET /health a cada 10min<br/>evita hibernação"| Render
```

Diferenças em relação à topologia mesma-origem (Compose):

| Aspecto | Compose (mesma origem) | Trio free (cross-site) |
| --- | --- | --- |
| Cookie de refresh | `SameSite=Lax` | **`SameSite=None; Secure`** (`COOKIE_SAMESITE=none`) |
| CORS | dispensável (Caddy roteia) | obrigatório: `CORS_ORIGIN` = origem(ns) da Vercel |
| TLS | Caddy (interno/Let's Encrypt) | nativo nas três plataformas |
| Migrações | entrypoint do container | `startCommand` do Render, via `DIRECT_URL` (sem pooler) |
| Latência fria | nenhuma | cold start do Render (~30–60s) — mitigável com ping |
| Persistência | volume Docker local | Neon (free permanente; o PG do Render free expiraria em 30d) |

O código é idêntico nas duas topologias — a diferença inteira vive em variáveis de ambiente
(`COOKIE_SAMESITE`, `CORS_ORIGIN`, `APP_URL`, `DATABASE_URL`/`DIRECT_URL`), o que mantém o
deploy como decisão de operação, não de arquitetura.

Estado do projeto, verificações e backlog: [`PROGRESSO.md`](PROGRESSO.md) e [`REVISAO.md`](REVISAO.md).
