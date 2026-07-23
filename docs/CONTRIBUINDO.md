# Guia de contribuição

Bem-vindo(a)! Este guia leva você do clone ao primeiro PR aceito. O projeto é um monorepo com
`backend/` (Fastify + Prisma) e `frontend/` (React + Vite); a filosofia central é **domínio puro
no servidor** — as regras acadêmicas vivem em funções sem efeitos, testáveis em milissegundos.

## 1. Subindo o ambiente em 10 minutos

Pré-requisitos: **Node 20+** (recomendado 22), **Docker** (só para o Postgres), git.

```bash
git clone https://github.com/higorfs295/Painel_UFG && cd Painel_UFG

# 1) banco
docker compose up -d db          # ou: docker run -d --name painel-db -e POSTGRES_USER=painel \
                                 #     -e POSTGRES_PASSWORD=painel -e POSTGRES_DB=painel -p 5432:5432 postgres:16

# 2) backend
cd backend
cp .env.example .env             # gere um JWT_SECRET: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm install
npx prisma migrate dev           # cria as tabelas + gera o client
SEED_ADMIN_PASSWORD='defina-uma-senha' npm run seed
npm run dev                      # http://localhost:3333/health -> {"ok":true}

# 3) frontend (outro terminal)
cd frontend && npm install && npm run dev    # http://localhost:5173
```

Login com o usuário do seed (e-mail em `backend/src/seed/perfil-higor.json`, senha =
`SEED_ADMIN_PASSWORD`) — ou crie sua conta em `/cadastro`.

### Gotchas conhecidos de ambiente

| Sintoma | Causa | Solução |
| --- | --- | --- |
| `npm install` trava/`UNABLE_TO_VERIFY_LEAF_SIGNATURE` | antivírus interceptando TLS (Avast…) | `NODE_EXTRA_CA_CERTS` apontando para o CA do antivírus (ver docs/DEPLOY.md §7.7) |
| `Environment variable not found: DIRECT_URL` | schema usa `directUrl` | no dev, `DIRECT_URL` = `DATABASE_URL` (está no `.env.example`) |
| Playwright ignora `VAR=x` no git-bash | wrapper `npx.cmd` descarta prefixos | `node node_modules/@playwright/test/cli.js test` |
| Arquivos "modificados" sem você tocar | CRLF/LF no Windows | o `.gitattributes` normaliza; não desligue o autocrlf |

## 2. O mapa do código (onde mexer para cada coisa)

```
backend/src/
├─ domain/      ⟵ REGRAS DE NEGÓCIO. Puro: sem Prisma, sem HTTP, sem Date.now() escondido.
│                 graph.ts (status/destravamento) · sums.ts (integralização) · sigaa.ts (parser)
│                 progress.ts (agregação) · period.ts (período/férias)
│                 loadCourse.ts / importCourse.ts (pontes Prisma⇄domínio, com cache/transação)
├─ lib/         ⟵ serviços com efeito isolado: session (refresh), invite, mailer, backup,
│                 ownership (posse), crypto, strip
├─ modules/     ⟵ SÓ orquestração HTTP: zod → posse → domínio/lib → resposta.
│                 Um handler gordo é cheiro de que algo devia descer para domain/ ou lib/.
├─ plugins/     ⟵ infraestrutura Fastify (security, prisma, auth/JWT)
└─ seed/        ⟵ matriz + perfil baseline (JSON) e o seed idempotente

frontend/src/
├─ api/         ⟵ client (fetch + refresh automático) · endpoints tipados · types
├─ store/       ⟵ Zustand: auth (sessão) e app (matrícula selecionada)
├─ pages/       ⟵ uma página por rota; consomem a API via TanStack Query
├─ components/  ⟵ ui/ (primitivas) · layout/ (casca) · ErrorBoundary
├─ lib/         ⟵ ESPELHOS de graph/sigaa/sums p/ feedback imediato (servidor decide)
└─ styles/      ⟵ index.css — Tailwind v4: @theme (tokens do cerrado) + @layer components
```

Referência função a função: `docs/MODULOS.md`. Regras do domínio explicadas: `docs/DOMINIO.md`.

## 3. Convenções que o projeto segue (e o CI cobra)

1. **Domínio puro primeiro.** Regra nova de negócio? Escreva a função em `domain/` com teste
   unitário ANTES de plugar na rota. Se precisa de banco para testar a regra, ela está no lugar
   errado.
2. **Posse em toda rota `/me`.** Qualquer recurso do usuário passa por `assert*Owner` — inclusive
   o que você acabou de criar. Teste o caso 403 (tentar acessar recurso alheio).
3. **zod em toda entrada.** Body, params e query. O erro central cuida da resposta 400.
4. **TypeScript estrito de verdade.** `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
   estão ligados. Padrões úteis: `stripUndefined()` para patches parciais → Prisma; guarda
   explícita (`if (!x) continue`) para índices; `!` só quando a garantia é estrutural (regex
   groups, find após criação) — com comentário do porquê.
5. **Imports com extensão `.js`** no backend (NodeNext) — mesmo apontando para `.ts`.
6. **Espelhos sincronizados.** Mudou `domain/{graph,sigaa,sums}.ts`? Replique em
   `frontend/src/lib/` (há um aviso no topo de cada arquivo).
7. **Migrações**: `npx prisma migrate dev --name descricao_curta`. Nunca edite migração já
   commitada; some uma nova. Enum: adicionar valor é seguro; remover/renomear exige plano.
8. **Mensagens de commit** no padrão `tipo(escopo): resumo` (`feat`, `fix`, `docs`, `test`,
   `perf`, `ci`…), corpo explicando o *porquê*.
9. **Acessibilidade não é opcional**: interativo → focável e com `aria-label` quando só-ícone;
   animação nova → dentro da guarda `prefers-reduced-motion`.

## 4. Testes (o contrato de qualidade)

Pirâmide do projeto e como rodar cada camada — detalhes em `docs/TESTES.md`:

```bash
cd backend
npm test                  # unit: domínio puro (ms, sem banco) — rode a cada save
npm run test:integration  # rotas reais via app.inject contra Postgres (precisa do db up)
npm run typecheck

cd ../frontend
npx tsc --noEmit && npm run build
E2E_USER_PASSWORD='<senha do seed>' npm run e2e   # Playwright (backend+db precisam estar up)
```

Regras de ouro:

- Feature de backend nova = teste de integração novo (mínimo: caminho feliz + 1 caso de
  autorização). Regra de domínio = teste unitário com números explicados em comentário.
- Testes de integração criam usuários `*@test.local` no banco configurado — aponte
  `TEST_DATABASE_URL` para um banco separado se não quiser poluir o seu de dev.
- E2E mutam a conta do seed e **se auto-limpam**; mantenha assim (crie → use → delete).

## 5. Fluxo de PR

1. Branch a partir da `main`: `git checkout -b feat/minha-feature origin/main`.
2. Commits pequenos e focados; o CI roda em todo push (`typecheck + unit + integração + build
   + e2e`) — verde é pré-condição de review.
3. PR com: **o que** muda, **por que**, como foi **verificado** (prints ajudam em UI), e
   referência ao RF/issue quando houver.
4. Se tocou em API: atualize `docs/API.md`. Se criou arquivo relevante: `docs/MODULOS.md`.
   Se mudou regra de negócio: `docs/DOMINIO.md` + `ESPECIFICACAO.md` (novo RF? numere na
   sequência).
5. Review: respondemos apontando arquivo/linha; ajustes vêm como commits novos (sem force-push
   durante a discussão).

### Checklist antes de abrir o PR

- [ ] `npm run typecheck` limpo nos dois lados
- [ ] testes das camadas afetadas passando (e novos testes para o novo comportamento)
- [ ] docs atualizados (API/MODULOS/DOMINIO/ESPECIFICACAO conforme o caso)
- [ ] UI: verificada em dark **e** light, desktop **e** ~375px, teclado navegando
- [ ] nenhum segredo/valor local commitado (`.env` fica fora; use `.env.example` para documentar)

## 6. Tour guiado: como uma feature atravessa o sistema

A melhor forma de aprender a arquitetura é seguir uma feature real de ponta a ponta. Este é o
caminho exato que o estado **CURSANDO (RF-19)** percorreu — use como gabarito para a sua:

### Passo 1 — Schema (quando há dado novo)

```prisma
enum SubjectState {
  APPROVED
  SIMULATED
  ENROLLED   // ← valor novo (aditivo = migração segura)
}
```

```bash
npx prisma migrate dev --name estado_cursando   # gera SQL + regenera o client tipado
```

Adicionar valor a enum é seguro; renomear/remover pede plano (dados existentes!). O client do
Prisma regenerado propaga o tipo novo — o TypeScript passa a apontar todo lugar que precisa de
atenção. Deixe o compilador trabalhar para você.

### Passo 2 — Domínio puro (a regra em si)

Em `domain/progress.ts`, a semântica: cursando **não** conta no oficial, **conta** na projeção,
**sai** das recomendações. Repare que a mudança é em conjuntos, não em ifs espalhados:

```ts
const approved  = new Set(statuses.filter(s => s.state === "APPROVED").map(s => s.seq));
const projected = new Set(statuses.map(s => s.seq));   // qualquer estado entra na projeção
const statused  = new Set(statuses.map(s => s.seq));   // recomendação pula todos
```

Nada aqui conhece HTTP ou Prisma — é por isso que o teste roda em milissegundos.

### Passo 3 — Borda HTTP (validação + persistência)

Em `modules/progress/routes.ts`, o enum do zod ganha o valor e o upsert continua igual:

```ts
const { state } = z.object({
  state: z.enum(["APPROVED", "SIMULATED", "ENROLLED"]).nullable(),
}).parse(req.body);
```

Se a feature tocasse dado de outro dono, aqui entraria o `assert*Owner` — o PUT já tinha.

### Passo 4 — Contratos que acompanham (o efeito dominó consciente)

Grep por `"APPROVED" | "SIMULATED"` acha os demais contratos que citam os estados:
`lib/backup.ts` (o backup precisa aceitar o estado novo) e os tipos do frontend. Atualize todos —
o typecheck estrito acusa o que faltar.

### Passo 5 — Teste de integração (a prova)

`test/integration/features.test.ts` verifica a semântica completa via HTTP real:

```ts
await put(subjects, { state: "ENROLLED" });
expect(prog.totals.hours).toBe(0);              // oficial não conta
expect(prog.projected.totals.hours).toBe(100);  // projeção conta
expect(recs.map(r => r.seq)).not.toContain(1);  // recomendações pulam
```

### Passo 6 — Frontend (tipos → endpoint → UI)

1. `api/types.ts`: `SubjectState` ganha `"ENROLLED"` (o resto do front é inferido daí).
2. `SubjectsPage`: terceiro botão no trio de ações; `Chip` ganha o tom `cursando` (azul-jenipapo).
3. Invalidação: a mutação já invalida `["progress"]` e `["recs"]` — a projeção atualiza sozinha.

### Passo 7 — Documentação

`API.md` (o PUT e seus efeitos), `DOMINIO.md` (a tabela de estados), `ESPECIFICACAO.md` (RF-19).
Se você chegou até aqui sem tocar em doc nenhuma, volte um passo. 🙂

**Resumo do padrão**: schema → domínio puro (com a regra em conjuntos/funções) → borda HTTP fina →
contratos irmãos (backup/tipos) → teste de integração da semântica → UI → docs. Sete passos, cada
um pequeno; o compilador e os testes seguram as pontas entre eles.

## 7. Ideias de primeira contribuição

Boas portas de entrada (issues marcadas `good first issue` quando existirem):

- **Realce de conflito de horário** na grade (o domínio `conflicts()` já existe; falta a UI).
- **Transcrever uma matriz nova** (outro curso) seguindo `docs/DOMINIO.md` §8 e o fluxo de
  `matrizes/README.md` (`npm run validar` te diz na hora se está íntegra) — contribuição de
  dados, zero código. Elétrica e Mecânica já estão lá como referência.
- **Tela de "acordando o servidor"** para o cold start do Render (retry com feedback).
- Tradução/i18n da UI (hoje pt-BR fixo).
- Mais testes de componente no frontend (hoje a cobertura pesada está no backend + E2E).

Dúvidas? Abra uma issue com o rótulo `question` — ou discuta no PR mesmo. Obrigado por contribuir! 🌅
