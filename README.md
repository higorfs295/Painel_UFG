# Painel Acadêmico

[![CI](https://github.com/higorfs295/Painel_UFG/actions/workflows/ci.yml/badge.svg)](https://github.com/higorfs295/Painel_UFG/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Aplicação web multiusuário para acompanhar a **integralização curricular** de cursos de
engenharia: quanto falta para se formar, o que cada disciplina destrava e como montar a grade
do próximo semestre. Nasceu como protótipo HTML de um aluno de Engenharia de Computação da UFG
e virou um monólito modular com autenticação, papéis (admin/usuário), cadastro público,
múltiplos cursos, optativas, atividades, período letivo e cronograma.

> **Não é um sistema oficial da UFG.** É um projeto independente; os números devem ser
> conferidos no SIGAA — em especial a contabilização de Núcleo Livre excedente, que é uma
> incerteza declarada (`ESPECIFICACAO.md` §15).

Leia primeiro `ESPECIFICACAO.md`; para entender o domínio a fundo, `docs/DOMINIO.md`.

**O que o sistema faz hoje**

| Para o aluno | Para o administrador |
| --- | --- |
| Integralização com regra do teto, marcos e projeção | Visão do sistema (usuários, cursos, crescimento, distribuição) |
| Disciplinas com três estados + **nota, faltas e período** | Gestão de usuários, papéis, convites e matrículas |
| **Histórico escolar** por período, **média ponderada por CH (MGA)** e ritmo de formatura | Catálogo e **importação de matrizes** (JSON) |
| Recomendações por destravamento transitivo | **Calendário acadêmico global** e agendável |
| Extras (optativas, Núcleo Livre, AC) com 3 estados e reclassificação | **Avisos** por audiência |
| **Agenda** de provas/entregas e anotações por disciplina | **Monitor**: métricas p50/p95/p99, memória, ping do banco |
| Cronograma semanal com códigos SIGAA, que **se preenche sozinho** a partir das disciplinas em curso | **Auditoria** de ações sensíveis |
| **Conquistas** derivadas do progresso | Configurações, teste de SMTP e gerador de dados de teste |
| Paleta de comandos (**Ctrl/⌘+K**), filtros e **exportação CSV** das tabelas | **Lixeira de cursos**: exclusão em duas etapas com 7 dias para desfazer |

Segurança: sessão com refresh rotativo (detecção de reuso), autorização por posse, auditoria e
**cifra de campo AES-256-GCM** para PII em repouso. Detalhes em [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

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
| [`docs/CONTRIBUINDO.md`](docs/CONTRIBUINDO.md) | **Guia do contribuidor**: mapa do código, convenções, fluxo de PR e um tour de uma feature ponta a ponta. |
| [`docs/CONTRIBUINDO.md`](docs/CONTRIBUINDO.md) | Guia de contribuição: setup em 10 min, convenções, fluxo de PR, primeiras issues. |
| [`docs/PROGRESSO.md`](docs/PROGRESSO.md) | Estado por fase e como rodar. |
| [`docs/REVISAO.md`](docs/REVISAO.md) | Revisão técnica (escala/concorrência/persistência/desempenho) + backlog. |

## Estrutura

- `backend/` — API Node.js + TypeScript (Fastify) + Prisma + PostgreSQL
- `web/` — Next.js (App Router) + TypeScript + Tailwind CSS v4
- `docker-compose.yml` — Postgres local (e, futuramente, API + web)

## Atalhos da raiz

O `package.json` da raiz **não** é um workspace — cada app tem o seu lockfile. São só atalhos:

```bash
npm run setup      # instala backend/ e web/
npm run dev:api    # API em :3333
npm run dev:web    # frontend em :5173
npm test           # unitários + integração do backend
npm run e2e        # Playwright (precisa dos dois no ar)
```

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
# (painel@aluno.com de demonstração + veterano@aluno.local com a baseline de exemplo).
# Adicione objetos em students.json para semear mais alunos. SEED_STUDENT_PASSWORD é opcional.
SEED_ADMIN_PASSWORD='defina-uma-senha-forte' npm run seed

# 5) Rodar a API
npm run dev                # http://localhost:3333  (GET /health -> {"ok":true})
#    documentação OpenAPI: http://localhost:3333/docs (desliga sozinha em produção)
```

> **Se a API subir mas as rotas de curso derem 500** com `Unknown argument 'deletedAt'` (ou outro
> campo recém-adicionado), o **Prisma Client está desatualizado** em relação ao schema — ele é
> gerado dentro de `node_modules` e não acompanha um `git pull`. O `npm run dev` já roda
> `prisma generate` antes de subir; se a mensagem for `EPERM ... query_engine-windows.dll.node`,
> é porque **outra instância da API está rodando** e segurando o arquivo: pare a outra e suba de novo.


> **Opcional, recomendado:** cifre o nº de matrícula (PII) em repouso — gere a chave e cole no
> `.env` como `FIELD_ENCRYPTION_KEY`. Sem ela o sistema funciona igual, só que em claro.
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```
> Depois de adotar, guarde a chave: perdê-la torna as matrículas já cifradas irrecuperáveis.

## Testes

```bash
cd backend
npm test                   # 43 unitários: domínio puro, cache e cripto (não precisam de banco)
npm run test:integration   # 66 de integração: rotas via app.inject (precisa do Postgres migrado)
npm run typecheck          # checagem de tipos (tsc --noEmit)
```

Em `web/`, `npx playwright test` roda os 13 E2E — precisa da API e do app no ar.
Detalhes em [`docs/TESTES.md`](docs/TESTES.md).

## Frontend (Next.js + Tailwind CSS v4)

```bash
cd web
npm install
npm run dev                # http://localhost:5173
# login: painel@admin.com (admin) ou painel@aluno.com (aluno) com a senha do SEED
```

App Router com **landing pública** (Server Component), autenticação em tela dividida e o
painel em rotas protegidas: **aluno** — Visão geral, Disciplinas, Extras, Cronograma,
Recomendações, Histórico, Agenda; **admin** — Visão do sistema, Usuários, Cursos, Períodos,
Avisos, Monitor, Configurações; e Ajustes/Ajuda compartilhadas.

Gráficos em SVG puro (sem biblioteca de chart), tema claro/escuro por `next-themes` com
tokens semânticos, paleta de comandos (**Ctrl/⌘+K**), exportação CSV das tabelas e
notificações com `react-hot-toast`. O frontend foi construído a partir de seis templates
Next.js — o que veio de cada um está em [`docs/DESIGN.md`](docs/DESIGN.md).

## Batizando o sistema (nome próprio em 1 linha)

Quer chamar a sua instância de outro nome? Edite **uma única constante** em
[`web/src/lib/branding.ts`](web/src/lib/branding.ts):

```ts
export const APP_NAME = "Painel Acadêmico";   // ← troque aqui
```

O nome se propaga para o cabeçalho, telas de login/cadastro/convite, título da aba do navegador
e tela de erro. (Há também `APP_TAGLINE`, o subtítulo das telas de entrada.)

## Acesso público por R$ 0

Quer colocar no ar? `docs/DEPLOY.md` traz o passo a passo do trio **Render (API) + Vercel
(frontend) + Neon (Postgres com pooler, free permanente)** — inclusive o `render.yaml` (blueprint)
e o `web/vercel.json` já prontos neste repositório.

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
- **courses** (RF-13/28): leitura da matriz, `POST /import` idempotente e **lixeira** (exclusão em duas etapas com confirmação do slug, restauração e expurgo automático em 7 dias).
- **progress** (RF-05/06/07): somas por composição com teto em 100% + excedente, status oficial×simulado, marcos, recomendações por destravamento.
- **extras** (RF-08/09): CRUD de optativas fora da matriz, NL, AC e registros.
- **schedules** (RF-10/11/12/29): cenários, disciplinas com validação SIGAA no servidor, pintura de células e **preenchimento automático** a partir das disciplinas cursando/simuladas (o aluno informa só o código de horário).

Lógica de domínio pura em `backend/src/domain/` (espelhada em `web/src/lib/`, testada em `backend/test/unit/`).
Autorização por posse (RNF-05) em toda rota `/me`; erros centralizados sem vazar stack trace (RNF-04).

O artefato HTML permanece como referência visual/comportamental de cada componente; o
frontend atual vive em `web/` (Next.js) — ver [`docs/DESIGN.md`](docs/DESIGN.md).

## Como contribuir

Contribuições são bem-vindas — inclusive as que não envolvem código. Leia
[`docs/CONTRIBUINDO.md`](docs/CONTRIBUINDO.md) antes de abrir um PR. O resumo:

1. **Domínio puro primeiro.** Regra nova de negócio? Função em `backend/src/domain/` com teste
   unitário *antes* de plugar na rota. Se precisa de banco para testar a regra, ela está no
   lugar errado.
2. **Posse em toda rota `/me`** via `assert*Owner`, com teste do caso 403.
3. **zod em toda entrada** — body, params e query.
4. **TypeScript estrito de verdade**: `exactOptionalPropertyTypes` e `noUncheckedIndexedAccess`
   ligados; imports com extensão `.js` no backend (NodeNext).
5. **Commits** no padrão `tipo(escopo): resumo`, com o corpo explicando o **porquê**.
6. **CI verde é pré-condição de review** — typecheck, unit, integração, build e E2E.

```bash
npm run typecheck     # backend + web
npm test              # unitários + integração (precisa do Postgres up)
npm run e2e           # Playwright (API + web no ar)
```

### Boas primeiras contribuições

- **Transcrever uma matriz curricular nova** seguindo `docs/DOMINIO.md` §8 e
  `matrizes/README.md`. `npm --prefix backend run validar` diz na hora se o JSON está íntegro.
  **Zero código.** Elétrica (2023) e Mecânica (2018) estão lá como referência.
- **Realce de conflito de horário** na grade: o domínio `conflicts()` existe, falta a UI.
- **Tela de "acordando o servidor"** para o cold start do plano free do Render.
- **i18n** — a interface é pt-BR fixo hoje.
- **Testes de componente no frontend** — a cobertura pesada está no backend e no E2E.

Dúvidas? Abra uma issue com o rótulo `question`.

**Vulnerabilidades: não abra issue pública.** Veja [`SECURITY.md`](SECURITY.md).

## Licença

[MIT](LICENSE).

As **matrizes curriculares** em `matrizes/` são transcrições de documentos públicos (Resoluções
CEPEC da UFG). O trabalho de transcrição segue a licença do projeto; o conteúdo original é da
instituição.
