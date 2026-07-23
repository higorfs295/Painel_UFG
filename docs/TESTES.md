# Estratégia de testes

Como o projeto se protege de regressões: três camadas com papéis distintos, todas no CI. A regra
geral é testar **comportamento** (o que o usuário/consumidor da API observa), não implementação.

## 1. A pirâmide do projeto

| Camada | Onde | O que cobre | Custo | Precisa de |
| --- | --- | --- | --- | --- |
| **Unitários** (43) | `backend/test/unit/` | domínio puro: grafo, somas, parser SIGAA, período, histórico/MGA, conquistas, crypto, cache | ~ms | nada |
| **Integração** (59) | `backend/test/integration/` | rotas HTTP reais (zod→posse→serviço→domínio→Prisma), auth, concorrência, gestão acadêmica, **cifra de campo**, **lixeira de cursos** e **cronograma inteligente** | ~s | Postgres |
| **E2E** (6) | `web/e2e/` | fluxos completos no navegador (login, simulação, extras, grade por teclado, admin) | ~30s | stack inteira |

Filosofia: a lógica acadêmica (a parte com mais nuance) fica em funções puras testadas em
milissegundos; a integração garante que a orquestração HTTP (validação, posse, transação) está
correta; o E2E garante que o conjunto — cliente com refresh de sessão, CORS, cookies — funciona
como o usuário vê.

## 2. Rodando

```bash
cd backend
npm test                    # unitários (rode a cada save — são instantâneos)
npm run test:integration    # exige Postgres migrado (docker compose up -d db && npx prisma migrate dev)
npm run test:watch          # vitest em modo watch

cd ../frontend
E2E_USER_PASSWORD='<senha do seed>' npm run e2e          # Linux/macOS
# Windows/git-bash (npx.cmd engole o prefixo de env):
E2E_USER_PASSWORD='<senha>' node node_modules/@playwright/test/cli.js test
```

Pré-requisitos do E2E local: API rodando em `:3333` e banco semeado (o Vite o Playwright sobe
sozinho, reaproveitando um dev server aberto). No CI o job `e2e` monta tudo do zero.

### Banco de testes separado (recomendado)

Os testes de integração criam usuários/cursos com sufixos aleatórios (`*@test.local`,
`curso-xxxx`) no banco configurado. Para não sujar seu banco de dev, crie um segundo banco e
aponte `TEST_DATABASE_URL` no `.env` — o setup do vitest troca a URL automaticamente:

```bash
docker exec painel-db psql -U painel -c 'CREATE DATABASE painel_test'
DATABASE_URL=postgresql://painel:painel@localhost:5432/painel_test npx prisma migrate deploy
# .env: TEST_DATABASE_URL="postgresql://painel:painel@localhost:5432/painel_test?schema=public"
```

## 3. Anatomia de cada camada

### 3.1 Unitários — números com explicação

Os testes de domínio documentam as regras com aritmética explícita em comentário. Exemplo real
(a regra do teto, `unit/progress.test.ts`):

```ts
it("total integralizado soma contribuições LIMITADAS ao mínimo", () => {
  // NC: raw 200 / min 100 -> conta 100 · NEO: raw 100 / min 500 -> conta 100
  // NL: raw 128 / min 128 -> conta 128  => 328 (não 428)
  expect(r.totals.hours).toBe(328);
});
```

Se você mudar uma regra e um número desses quebrar, o comentário diz na hora se o teste está
desatualizado ou se você introduziu um bug. Mantenha esse estilo.

### 3.2 Integração — `app.inject` (sem porta, sem rede)

Usamos o injetor do Fastify: monta a app real (plugins, zod, erro central, Prisma) e injeta
requests sem abrir socket — rápido e determinístico. Helpers em `test/integration/helpers.ts`:

```ts
const app = await makeApp();                       // app real + guarda de DATABASE_URL
const user = await createUser(app, { password }); // direto no banco, e-mail único
const { accessToken, refreshCookie } = await login(app, email, password); // via HTTP
```

Padrões cobertos que valem imitar:

- **Autorização**: todo recurso testa o dono (2xx) e um intruso (403) — `progress.test.ts`.
- **Concorrência**: `session.test.ts` dispara dois refresh com o MESMO token em `Promise.all`
  e exige exatamente um vencedor (prova do claim atômico).
- **Roundtrip**: `account.test.ts` exporta backup → apaga tudo → importa → confere o estado.
- **Semântica nova ponta a ponta**: `features.test.ts` (ENROLLED, período, senha, admin).

Isolamento: cada teste cria SEUS usuários/cursos com identificadores únicos (`uniqueEmail`,
`uniqueSlug`) — nada de depender de estado de outro teste. Os arquivos rodam em série
(`--no-file-parallelism`) porque compartilham o banco.

### 3.3 E2E — Playwright, o usuário de verdade

13 testes em `web/e2e/`, rodando em série contra a conta do seed:

- `smoke.spec` — a **página pública**; o aluno percorrendo as 9 telas do painel e o admin as
  7 de gestão, cada passagem exigindo o título certo, **zero erro de console** e nenhum
  vazamento de largura; as duas guardas de rota (papel errado e sem sessão).
- `fluxos.spec` — o que escreve no servidor: simular/limpar disciplina; extra "em andamento"
  com reclassificação de categoria; cenário de cronograma com navegação por teclado e
  pintura; agendamento de virada de período; paleta de comandos (Ctrl+K); e a lixeira de
  cursos recusando confirmação errada (RF-28).

Convenções: seletores por **papel/rótulo acessível** (`getByRole`, `getByLabel`) — se o teste
não acha, um leitor de tela também não; asserções que aguardam o servidor usam o auto-retry
do `expect` com timeout explícito; os testes **se auto-limpam**.

- `visual.spec` — acabamento que quebra em silêncio: o **contraste** do texto secundário
  medido nos dois temas (exige AA, 4.5:1) e o **indicador do item ativo** da barra lateral.

> **Navegue pela interface, não por `page.goto` em cada rota.** Cada carga completa refaz o
> bootstrap da sessão, e refreshes sobrepostos disparam a detecção de reuso do token — que
> existe justamente para revogar sessões suspeitas. Clicar na barra lateral é o caminho real
> do usuário e não esbarra nisso.

História ilustrativa: foi um E2E que revelou que TODOS os DELETEs da UI estavam quebrados
(o cliente mandava `Content-Type: application/json` sem corpo e o Fastify respondia 400) — a
integração não pegava porque `app.inject` não enviava o header. Moral: as camadas se complementam;
nenhuma substitui a outra.

## 4. No CI

`.github/workflows/ci.yml`, três jobs em paralelo a cada push/PR:

| Job | Faz |
| --- | --- |
| `backend` | Postgres de serviço → `prisma migrate deploy` → typecheck → unit → integração |
| `frontend` | `tsc --noEmit` + `vite build` |
| `e2e` | Postgres → migrate+seed → API em background → Playwright/chromium → artefato do report em falha |

Verde no CI é pré-condição de merge. Se o e2e falhar só no CI, baixe o artefato
`playwright-report` da run para ver screenshots/trace.

## 5. Escrevendo o próximo teste (receitas)

- **Nova regra de domínio** → arquivo em `test/unit/`, monte a menor matriz possível que exercite
  a regra (veja o `S()` helper nos testes existentes), comente a aritmética.
- **Novo endpoint** → `test/integration/`: caminho feliz, validação (payload inválido → 400),
  autorização (sem token → 401; recurso alheio → 403/404), e efeitos (o banco mudou como devia?).
- **Novo fluxo de UI** → só suba para E2E o que é *jornada* (multi-página, sessão, teclado);
  detalhe visual fica para verificação manual/screenshot no PR.
- **Bug corrigido** → escreva primeiro o teste que reproduz (vermelho), corrija (verde), e deixe
  o teste como cicatriz permanente.

## 6. Depurando falhas (receitas de campo)

**Integração falhando com `P1001`/timeout** → o Postgres não está de pé (`docker compose up -d db`)
ou a `DATABASE_URL` aponta para o lugar errado. O helper `makeApp()` falha cedo com mensagem clara
quando a variável falta.

**Integração falhando só depois de mudar o schema** → esqueceu `npx prisma migrate dev` (aplica no
banco) ou o client está velho (`npx prisma generate`). No Windows, o generate falha com `EPERM` se
um servidor Node estiver rodando (a DLL do engine fica travada) — pare o `npm run dev` antes.

**`Drift detected` no migrate** → seu banco local tem uma lineage de migrações diferente da pasta
`prisma/migrations` (comum após rebase/merge). Em dev: `npx prisma migrate reset --force` e re-seed.
Nunca "conserte" drift editando migração já commitada.

**Unit quebrou depois de mexer no domínio** → leia o comentário aritmético do teste antes de
"ajustar o número": ele diz qual regra o valor codifica. Se a regra mudou de propósito, atualize
número **e** comentário; se não mudou, o bug é seu.

**E2E vermelho só no CI** → baixe o artefato `playwright-report` da run (Actions → run → Artifacts):
tem screenshot, trace navegável (`npx playwright show-trace trace.zip`) e o passo exato da falha.
Local, rode com `--headed` para assistir: `node node_modules/@playwright/test/cli.js test --headed`.

**E2E local não loga** → `E2E_USER_PASSWORD` não chegou (no git-bash do Windows use a forma
`node node_modules/@playwright/test/cli.js`, não `npx`) ou o seed local usa outra senha.

**Timeout esperando elemento que "está lá"** → provavelmente o elemento re-renderizou (React troca
o nó; a referência antiga morre). Re-localize após ações que disparam refetch — os specs fazem
`cell.focus()` de novo após a pintura exatamente por isso.

## 7. Cobertura: o que medimos e o que não

Não perseguimos porcentagem de linhas — perseguimos **regras cobertas**. O contrato é: toda regra
de `domain/` tem unit; todo endpoint tem integração de caminho feliz + autorização; toda jornada
crítica de UI tem E2E. Um PR que adiciona regra sem teste correspondente volta com pedido de
teste, mesmo que "funcione na minha máquina" — o teste é a especificação executável da regra.
