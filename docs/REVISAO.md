# Revisão técnica detalhada — Painel Acadêmico

Auditoria do projeto sob cinco lentes: **escalabilidade, concorrência, persistência, desempenho e
modernidade** (+ segurança, transversal). Cada achado traz `arquivo:linha`, impacto e recomendação.
Os itens marcados **✅ Corrigido** foram aplicados nesta revisão (com teste quando cabível); os
**🔷 Recomendado** ficam como backlog priorizado ao final.

## Metodologia e escopo
Leitura linha a linha do backend (domínio, libs, rotas, plugins, schema) e do frontend (cliente,
stores, páginas), cruzando com o comportamento verificado em execução (37 testes + navegador).
Foco em corretude sob concorrência, integridade e índices de dados, custo por request, prontidão para
réplicas e aderência a práticas atuais.

## Sumário executivo
O projeto está **sólido e coeso**: API stateless com JWT+refresh rotativo, autorização por posse em
todas as rotas, domínio puro testado, erro central sem vazar stack, e um frontend funcional. Os riscos
mais relevantes encontrados eram: (1) uma **corrida na rotação de refresh** que furava a detecção de
reuso; (2) **índices ausentes** em várias FKs consultadas; (3) **import N+1 sem transação**; (4)
**encerramento não-gracioso**; (5) **crescimento ilimitado** das tabelas de token. Os cinco foram
corrigidos. Os pendentes são de escala (rate-limit distribuído, cache de grafo, pool/PgBouncer) e de
processo (CI, headers no SPA), documentados abaixo.

---

## 1. Concorrência

### 1.1 ✅ Corrida na rotação de refresh (era o achado mais sério)
`backend/src/lib/session.ts` — o fluxo era *check-then-act*: lia a linha, verificava `revokedAt`, e só
então revogava+criava em transação. Dois refresh concorrentes com o **mesmo** token válido passavam
ambos pela verificação e **emitiam dois tokens novos**, sem disparar a detecção de reuso (proliferação
de tokens e janela de falso-negativo na detecção de vazamento).
**Correção:** o "claim" da rotação virou atômico — `updateMany({ where: { id, revokedAt: null } })`
dentro de transação; o lock de linha do Postgres serializa e apenas **um** vencedor cria o próximo
token, o perdedor recebe `reuse`. Teste de concorrência em `test/integration/session.test.ts`
(dispara dois `rotate` em `Promise.all` e exige exatamente 1 vencedor + 1 token ativo).

### 1.2 ✅ Cliente deduplica refresh concorrente
`frontend/src/api/client.ts:22` — múltiplas requisições que recebem 401 compartilham a mesma promise
de refresh (`refreshing`), evitando N chamadas simultâneas. Já estava correto; validado na revisão.

### 1.3 🔷 `copyFrom` de cenário — asserção não-nula após find (TOCTOU)
`backend/src/modules/schedules/routes.ts:52` usa `full!` após `findUnique`; se o cenário de origem for
excluído entre o `assertScenarioOwner` e o `findUnique`, quebra. Janela mínima; recomenda-se checar
`null` e responder 404.

### 1.4 🔷 Escritas concorrentes sem *optimistic locking*
Não há `@updatedAt`/versão nas linhas mutáveis (SubjectStatus, ExtraComponent, Scenario…). Como cada
recurso pertence a um único usuário, "último a escrever vence" é aceitável hoje; se houver edição
multi-aba intensa, considerar `updatedAt` + `If-Unmodified-Since`.

---

## 2. Persistência

### 2.1 ✅ Índices ausentes em chaves estrangeiras consultadas
O Postgres **não** cria índice automático em FK. Várias consultas filtravam por FK sem índice →
*seq scan* que degrada com o volume. Adicionados (migration `..._indices_e_expurgo`):
`RefreshToken(userId)`, `RefreshToken(expiresAt)`, `InviteToken(userId)`, `Requisite(subjectId)`,
`Requisite(requiresSubjectId)`, `ExtraComponent(enrollmentId)`, `Scenario(enrollmentId)`,
`ScenarioDiscipline(scenarioId)`. (Os demais acessos já eram cobertos por `@@unique` compostos —
ex.: `SubjectStatus(enrollmentId,subjectId)`, `Enrollment(userId,courseId)`.)

### 2.2 ✅ Crescimento ilimitado das tabelas de token
`RefreshToken`/`InviteToken` nunca eram removidos (só `revokedAt`/`usedAt`). Adicionado
`pruneRefreshTokens()` em `session.ts` (remove vencidos e revogados antigos) + índice em `expiresAt`.
Falta **agendar** a chamada (ver 5.3).

### 2.3 ✅ Requisitos órfãos no import
`domain/importCourse.ts` — quando um requisito apontava para um `seq` inexistente, criava-se uma linha
`Requisite` com `requiresSubjectId` **e** `milestoneKey` nulos (lixo semântico). Agora esses são
ignorados explicitamente.

### 2.4 🔷 `theme` como `String` livre
`schema.prisma` — `User.theme String @default("dark")`; a aplicação trata como `"dark"|"light"`. Um
`enum Theme` no banco daria integridade. Baixo risco (validado no zod da rota).

---

## 3. Desempenho

### 3.1 ✅ Import N+1 sem transação
`domain/importCourse.ts` fazia, por request, ~120 upserts de disciplina **e** ~200 `create` de
requisito, um-a-um, fora de transação (import parcial deixava o curso inconsistente). Reescrito para
rodar em **uma transação** (`timeout 30s`) e inserir requisitos em **lote** (`createMany`): de ~200
round-trips para 1 `deleteMany` + 1 `createMany`. Re-seed com a matriz real (120 disciplinas) validado.

### 3.2 🔷 Grafo do curso recarregado a cada request (sem cache)
`domain/loadCourse.ts` lê o curso inteiro (disciplinas + requisitos) em `GET /progress` **e**
`GET /recommendations`. Abrir a Visão geral dispara os dois → **2× a carga completa** do mesmo curso
imutável. Recomendo um cache em memória por `courseId` (Map/LRU) invalidado no `importCourse` — a
própria ESPECIFICACAO prevê "grafo em memória". Ganho grande sob muitos usuários no mesmo curso.

### 3.3 🔷 Frontend refetch redundante de enrollments
`frontend/src/pages/SubjectsPage.tsx` refaz `me.enrollments()` só para obter o `slug` (que o layout já
tem em cache) antes de `courses.detail`. Passar o slug via cache do React Query elimina uma ida à rede.

### 3.4 🔷 Sem *code-splitting* no bundle
`frontend` gera um único chunk (~244 KB). `React.lazy` por rota reduz o carregamento inicial. Cosmético
nesta escala.

---

## 4. Escalabilidade

### 4.1 🔷 Rate limit em memória não escala em réplicas (contraria RNF-07)
`plugins/security.ts` usa o store padrão (em processo) do `@fastify/rate-limit`. Com N réplicas atrás
de um balanceador, o limite efetivo vira N×max e a proteção de brute-force enfraquece. Para escalar
horizontalmente, usar store **compartilhado (Redis)** — o plugin suporta via opção `redis`.

### 4.2 🔷 Pool de conexões do Prisma / PgBouncer
`plugins/prisma.ts` instancia `PrismaClient` com pool padrão (`num_cpus*2+1`). Muitas réplicas podem
esgotar `max_connections` do Postgres. Em produção: dimensionar `connection_limit` na `DATABASE_URL`
e colocar **PgBouncer** (transaction pooling) à frente.

### 4.3 ✅ Encerramento gracioso
`server.ts` não tratava `SIGTERM`/`SIGINT` — sob `docker stop`/k8s o processo morria dropando requests
em voo e sem desconectar o Prisma. Adicionados handlers que fazem `app.close()` (drena requests +
dispara o `onClose` que desconecta o Prisma). `PORT` agora vem do ambiente.

### 4.4 ✅ Statelessness
Sessão via JWT + refresh em cookie; nenhum estado de sessão em memória do processo → pronto para
réplicas (uma vez resolvidos 4.1 e 4.2).

---

## 5. Modernidade, processo e segurança

### 5.1 🔷 Sem pipeline de CI
Não há workflow (ex.: GitHub Actions) rodando `typecheck` + `test` + `build` em cada push/PR. É o
próximo reforço de processo de maior valor; sugiro um job para backend (Postgres de serviço) e front.

### 5.2 🔷 Headers de segurança do SPA
`helmet` cobre a **API**; o SPA servido por nginx não emite CSP/HSTS/X-Frame-Options. Adicionar esses
headers no `nginx.conf` ou no Caddy (o Caddy já pode injetá-los no bloco do site).

### 5.3 🔷 Agendar expurgo de tokens
`pruneRefreshTokens()` existe mas não é chamado. Agendar (cron/worker, ou um `setInterval` diário no
boot com trava para uma única réplica).

### 5.4 🔷 Enumeração de usuário por timing no login
`modules/auth/routes.ts` — quando o e-mail não existe ou não tem senha, retorna 401 **sem** rodar
`argon2.verify`, o que difere no tempo de resposta de uma senha errada (que roda o hash). Um
`argon2.verify` contra um hash "dummy" nesses casos equaliza o tempo. Baixa severidade (há rate limit).

### 5.5 🔷 Ergonomia de tipos/tests
Backend não typecheca `test/` (o `tsconfig` inclui só `src`); `noUnusedLocals` está ligado no front e
desligado no back. Padronizar e adicionar um `tsconfig` de teste dá rede de segurança nos próprios testes.

### 5.6 🔷 Robustez de UI
Sem *error boundary* global no React nem estados de erro em algumas queries — uma falha de rede pode
render vazio. TanStack Query expõe `error`; tratar nas páginas principais.

### 5.7 🔷 React Router — flags de futuro
Warnings de `v7_startTransition`/`v7_relativeSplatPath`. Optar pelas flags agora facilita a futura
migração para o React Router 7.

---

## Correções aplicadas nesta revisão
1. Claim atômico na rotação de refresh + teste de concorrência (1.1).
2. Índices em 8 FKs consultadas via migration (2.1).
3. `pruneRefreshTokens()` + índice em `expiresAt` (2.2) e teste.
4. Import idempotente em transação com `createMany`; órfãos ignorados (2.3, 3.1).
5. Encerramento gracioso (SIGTERM/SIGINT) + `PORT` por ambiente (4.3).

**Verificação:** 37 testes verdes (22 unit + 15 integração), typecheck limpo, migration aplicada,
re-seed com a matriz completa OK.

## Backlog priorizado (recomendado)
| Prio | Item | Lente |
| --- | --- | --- |
| P1 | Cache do grafo de curso em memória invalidado no import (3.2) | Desempenho |
| P1 | CI (typecheck+test+build) (5.1) | Processo |
| P1 | Rate-limit com store Redis para réplicas (4.1) | Escalabilidade |
| P2 | Agendar `pruneRefreshTokens` (5.3) | Persistência |
| P2 | Headers de segurança no SPA (5.2); PgBouncer/pool (4.2) | Segurança/Escala |
| P2 | `TEST_DATABASE_URL` separado (testes poluem o banco de dev) | Processo |
| P3 | Timing de login (5.4), error boundary (5.6), code-split (3.4), theme enum (2.4) | Diversos |
