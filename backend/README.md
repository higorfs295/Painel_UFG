# Backend — Painel Acadêmico

API do Painel Acadêmico: Node.js com TypeScript, framework Fastify, ORM Prisma e banco PostgreSQL. Organizada como monólito modular — plugins de infraestrutura mais módulos de domínio, cada um com suas rotas.

> As regras de negócio, o contrato de API e os requisitos estão na **[../ESPECIFICACAO.md](../ESPECIFICACAO.md)**. Este README cobre a operação e a estrutura do backend.

---

## Estrutura

``
backend/
├── prisma/
│   └── schema.prisma       modelo de dados completo (User, Course, Subject, Enrollment, ...)
├── src/
│   ├── env.ts              carrega e valida variáveis de ambiente com zod (falha cedo)
│   ├── app.ts              fábrica Fastify: registra plugins e módulos
│   ├── server.ts           ponto de entrada (listen)
│   ├── plugins/
│   │   ├── security.ts     helmet + CORS + rate limit
│   │   ├── prisma.ts       injeta o PrismaClient na instância
│   │   └── auth.ts         JWT + decorators requireAuth / requireAdmin
│   ├── modules/
│   │   ├── auth/           convite, login, refresh, logout, reset
│   │   ├── users/          administração de contas (somente admin)
│   │   ├── courses/        catálogo de cursos e importação de matriz
│   │   ├── progress/       status de disciplinas, somas, recomendações
│   │   ├── extras/         optativas externas, NL, AC e registros
│   │   └── schedules/      cenários, disciplinas de horário e pintura
│   └── seed/
│       ├── matriz-engcomp-2021.json   matriz oficial (120 disciplinas)
│       ├── perfil-higor.json          baseline auditada do extrato
│       └── seed.ts                    popula curso e conta de referência
└── package.json
``

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. O `env.ts` valida na inicialização e **aborta se algo estiver ausente ou inválido** — inclusive exige `JWT_SECRET` com pelo menos 32 caracteres.

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | string de conexão do PostgreSQL |
| `JWT_SECRET` | segredo do JWT; **gere um valor aleatório** (o `.env.example` traz o comando) — não é um comando a colar, é o resultado dele |
| `JWT_EXPIRES` | validade do token de acesso (ex.: `15m`) |
| `REFRESH_EXPIRES_DAYS` | validade do refresh token em dias |
| `CORS_ORIGIN` | origem permitida do frontend |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | limite global de requisições |
| `SEED_ADMIN_PASSWORD` | senha do admin criada pelo seed (passe na execução, não deixe fixa) |

> **Erro comum:** colar o *comando* de geração no lugar do *valor* de `JWT_SECRET`. O `.env.example` deste projeto mostra o comando em comentário e reserva o campo do valor para o resultado. Se a aplicação não sobe e a mensagem cita validação de ambiente, é quase sempre um `JWT_SECRET` curto ou vazio.

---

## Passo a passo

```bash
docker compose up -d db                 # a partir da raiz do repositório
cd backend
cp .env.example .env                    # edite: gere o JWT_SECRET
npm install
npx prisma migrate dev --name init      # cria as tabelas
SEED_ADMIN_PASSWORD='senha-forte' npm run seed
npm run dev                             # API em http://localhost:3333
```

Health-check: `curl http://localhost:3333/health` → `{"ok":true}`.

### Scripts

| Script | Ação |
| --- | --- |
| `npm run dev` | sobe a API em modo watch |
| `npm run seed` | popula curso e conta de referência (requer `SEED_ADMIN_PASSWORD`) |
| `npm run migrate` | aplica migrações do Prisma em desenvolvimento |

---

## Banco de dados e seed

O schema está em `prisma/schema.prisma`. As composições de carga horária (NC/NEO/OPT/NL/AC) e os marcos (CH1/CH2/CH3) são **linhas** vinculadas ao curso, não colunas fixas — é isso que permite cadastrar cursos com estruturas diferentes sem alterar o schema.

O seed (`src/seed/seed.ts`) é idempotente: usa `upsert`, então rodar mais de uma vez não duplica dados. Ele lê a matriz e o perfil dos arquivos JSON via `readFileSync` (não por `import`), popula o curso completo em duas passadas (primeiro as disciplinas, depois os requisitos por número de sequência) e cria a conta admin de referência com a senha vinda de `SEED_ADMIN_PASSWORD`.

---

## Módulos e estado de implementação

Os módulos de domínio expõem as rotas do contrato de API (especificação, §11) com validação de entrada por zod. Na fundação, os handlers respondem `501` referenciando o requisito que implementam (por exemplo, `RF-03` no login) — são os pontos de trabalho previstos no roadmap. Cada arquivo de rota traz, em comentário, a orientação de implementação e o algoritmo esperado.

A lógica de domínio que também precisa rodar no servidor (validação de código SIGAA, cálculo de elegibilidade de disciplina) deve espelhar as funções puras do frontend em `src/lib` — a recomendação da especificação (RNF-09) é extrair essa lógica para um módulo compartilhado ou reimplementá-la aqui, com o servidor sempre como fonte de verdade.

---

## Segurança

Senhas com argon2; tokens de convite e refresh guardados apenas como hash. Cabeçalhos de segurança por helmet, CORS restrito à origem do frontend, rate limit global (e, no roadmap, mais estrito nas rotas de autenticação). Autorização por posse em toda rota de recurso do usuário: um usuário nunca acessa recurso de outro, mesmo conhecendo o identificador. Nenhum segredo é versionado. Detalhes na especificação, §§12–13.

---

## Notas de compilação

O `tsconfig.json` usa `module: nodenext` com `verbatimModuleSyntax`, então imports internos usam extensão `.js` (ex.: `./app.js`) mesmo apontando para arquivos `.ts` — é o comportamento esperado do NodeNext. O código usa APIs de Node (`node:fs`, `node:url`, `process`), portanto **`@types/node` precisa estar instalado** e listado em `types` do tsconfig; sem isso, a checagem de tipos falha. Confira também a compatibilidade das versões dos plugins `@fastify/*` com a versão do Fastify — plugins mudam assinaturas entre versões maiores.
