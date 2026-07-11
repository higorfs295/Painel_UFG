# Painel Acadêmico — base do projeto (monólito modular)

Evolução do protótipo em artefato para uma aplicação real multiusuário, com autenticação,
papéis (admin/usuário), cadastro público, múltiplos cursos e os módulos de progresso (com estados
aprovada/cursando/simulada), optativas, atividades, período letivo e cronograma.
Leia primeiro `ESPECIFICACAO.md`; para entender o domínio a fundo, `docs/DOMINIO.md`.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [`ESPECIFICACAO.md`](ESPECIFICACAO.md) | Requisitos funcionais (RF) e não-funcionais (RNF), escopo. |
| [`docs/DOMINIO.md`](docs/DOMINIO.md) | **Comece aqui** para entender o problema: matriz, integralização (regra do teto), grafo de requisitos, estados de disciplina, SIGAA, período — com exemplos numéricos. |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Diagramas (componentes, autenticação, modelo de dados, progresso, deploy), camadas e decisões de projeto. |
| [`docs/API.md`](docs/API.md) | Referência de endpoints com exemplos de `curl` e JSON. |
| [`docs/MODULOS.md`](docs/MODULOS.md) | Referência arquivo a arquivo / função a função (backend e frontend). |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Do dev local ao ar por R$ 0 (Render + Vercel + Neon), Docker Compose, e-mail SMTP e solução de problemas. |
| [`docs/SEGURANCA.md`](docs/SEGURANCA.md) | Modelo de ameaças, ciclo de vida dos tokens, decisões de autenticação/autorização e checklist de produção. |
| [`docs/TESTES.md`](docs/TESTES.md) | A pirâmide de testes: como rodar, como escrever, o que cada camada cobre. |
| [`docs/CONTRIBUINDO.md`](docs/CONTRIBUINDO.md) | Guia de contribuição: setup em 10 min, convenções, fluxo de PR, primeiras issues. |
| [`docs/PROGRESSO.md`](docs/PROGRESSO.md) | Estado por fase e como rodar. |
| [`docs/REVISAO.md`](docs/REVISAO.md) | Revisão técnica (escala/concorrência/persistência/desempenho) + backlog. |

## Estrutura

- `backend/` — API Node.js + TypeScript (Fastify) + Prisma + PostgreSQL
- `frontend/` — React + Vite + TypeScript (componentes portados do protótipo)
- `docker-compose.yml` — Postgres local (e, futuramente, API + web)

## Pré-requisitos

- **Node.js 20+ LTS** (recomendado 22). Instale: `winget install OpenJS.NodeJS.LTS`
- **Docker Desktop** rodando (usado apenas para o PostgreSQL nesta fase).

## Subir o ambiente (backend)

```bash
# 1) Postgres via Docker (na raiz do projeto)
docker compose up -d db
#   fallback sem compose:
#   docker run -d --name painel-db -e POSTGRES_USER=painel -e POSTGRES_PASSWORD=painel \
#     -e POSTGRES_DB=painel -p 5432:5432 -v painel_dbdata:/var/lib/postgresql/data postgres:16

# 2) Configurar e instalar o backend
cd backend
cp .env.example .env
#   gere um JWT_SECRET forte e cole no .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm install

# 3) Migrar o schema (gera o Prisma Client e cria as tabelas)
npm run migrate            # prisma migrate dev --name init (na 1ª vez pede o nome)

# 4) Popular o banco (curso EngComp + contas-modelo) — senha via env, nunca versionada.
# Cria: painel@admin.com (ADMIN, sem matrícula) e as contas-aluno de src/seed/students.json
# (painel@aluno.com de demonstração + higor_ferreira@discente.ufg.br com a baseline).
# Adicione objetos em students.json para semear mais alunos. SEED_STUDENT_PASSWORD é opcional.
SEED_ADMIN_PASSWORD='defina-uma-senha-forte' npm run seed

# 5) Rodar a API
npm run dev                # http://localhost:3333  (GET /health -> {"ok":true})
```

## Testes

```bash
cd backend
npm test                   # unitários: domínio puro + crypto (não precisam de banco)
npm run test:integration   # integração: rotas via app.inject (precisa do Postgres migrado)
npm run typecheck          # checagem de tipos (tsc --noEmit)
```

## Frontend (React + Vite + TanStack Query)

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
# login: painel@admin.com (admin) ou painel@aluno.com (aluno) com a senha do SEED
```

Páginas: Login, **Cadastro** (auto-registro, RF-17), Convite, Visão geral, Disciplinas (com os
três estados: aprovada/cursando/simulada), Extras, Cronograma, Ajustes (senha, período letivo,
matrículas, tema, backup) e Admin (estatísticas, papéis, matrículas). Consome a API via TanStack
Query; sessão com refresh automático; chip de período/férias no topo; tema claro/escuro persistido.

## Batizando o sistema (nome próprio em 1 linha)

Quer chamar a sua instância de outro nome? Edite **uma única constante** em
[`frontend/src/branding.ts`](frontend/src/branding.ts):

```ts
export const APP_NAME = "Painel Acadêmico";   // ← troque aqui
```

O nome se propaga para o cabeçalho, telas de login/cadastro/convite, título da aba do navegador
e tela de erro. (Há também `APP_TAGLINE`, o subtítulo das telas de entrada.)

## Acesso público por R$ 0

Quer colocar no ar? `docs/DEPLOY.md` traz o passo a passo do trio **Render (API) + Vercel
(frontend) + Neon (Postgres com pooler, free permanente)** — inclusive o `render.yaml` (blueprint)
e o `frontend/vercel.json` já prontos neste repositório.

## Stack completa com Docker (opcional)

Requer o plugin Docker Compose v2. Sobe Postgres + API + Web + Caddy (TLS + proxy, mesma origem):

```bash
cp .env.example .env       # defina JWT_SECRET
docker compose up --build
docker compose run --rm -e SEED_ADMIN_PASSWORD='...' api npm run seed
# acesse https://localhost
```

> Detalhes do progresso, verificações e nota sobre o Avast/TLS em `docs/PROGRESSO.md`.

## Estado do código

Módulos implementados (handlers antes em TODO):

- **auth** (RF-02/03/04): convite→senha (argon2), login, refresh rotativo com detecção de reuso, logout, reset.
- **users** (RF-01): CRUD admin, criação sem senha + link de convite, reemissão.
- **courses** (RF-13): leitura da matriz e `POST /import` idempotente (mesmo formato do seed).
- **progress** (RF-05/06/07): somas por composição com teto em 100% + excedente, status oficial×simulado, marcos, recomendações por destravamento.
- **extras** (RF-08/09): CRUD de optativas fora da matriz, NL, AC e registros.
- **schedules** (RF-10/11/12): cenários, disciplinas com validação SIGAA no servidor, pintura de células.

Lógica de domínio pura em `backend/src/domain/` (portada de `frontend/src/lib/`, testada em `backend/test/unit/`).
Autorização por posse (RNF-05) em toda rota `/me`; erros centralizados sem vazar stack trace (RNF-04).

O artefato HTML permanece como referência visual/comportamental de cada componente.
