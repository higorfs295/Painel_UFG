# Segurança — modelo, decisões e ciclo de vida dos tokens

Documento de referência das decisões de segurança do Painel Acadêmico: o que protegemos, contra
o quê, e por que cada mecanismo é como é. Leia antes de tocar em `lib/session.ts`, `lib/invite.ts`,
`plugins/auth.ts` ou nas rotas de `/auth`.

## 1. Modelo de ameaças (o que está no escopo)

Ativos: credenciais dos usuários, dados acadêmicos pessoais (histórico, planos), a integridade
da instância (papéis ADMIN).

| Ameaça | Mitigação principal |
| --- | --- |
| Vazamento do banco | senhas com **argon2id**; tokens de convite/refresh guardados **só como hash** — nada no banco loga alguém |
| Roubo do cookie de refresh | rotação a cada uso + **detecção de reuso** que revoga a família inteira |
| XSS roubando sessão | access token **em memória** (nunca em localStorage); refresh em cookie **httpOnly** (JS não lê) |
| Força bruta de login/convite | rate limit global + **10 req/min** nas rotas com segredo; resposta uniforme |
| Enumeração de contas | mesma resposta para "e-mail não existe" e "senha errada", com **custo de tempo equalizado** (argon2 roda nos dois caminhos) |
| Escalada horizontal (ver dados de outrem) | **autorização por posse** em toda rota `/me` (RNF-05) |
| Escalada vertical (virar admin) | `requireAdmin` no servidor; proteções de auto-rebaixamento/auto-remoção |
| Payload malicioso | validação **zod** em todo body/param/query; erro central sem stack trace |
| Logs vazando segredo | redaction do pino (Authorization, cookies, password/token) — RNF-10 |

Fora do escopo da v1: 2FA, detecção de sessão anômala por geolocalização, auditoria imutável.

## 2. Arquitetura de sessão (o coração)

Dois tokens com papéis distintos:

| | Access token | Refresh token |
| --- | --- | --- |
| Formato | JWT assinado (HS256) | opaco (32 bytes aleatórios, base64url) |
| Vida | ~15 min (`JWT_EXPIRES`) | ~14 dias (`REFRESH_EXPIRES_DAYS`) |
| Onde vive | memória do SPA + header `Authorization` | cookie `httpOnly` (path `/auth`) |
| No banco | nada (stateless) | **só o sha256** (`RefreshToken.tokenHash`) |
| Revogável? | não (expira sozinho) | sim (`revokedAt`) |

### 2.1 Ciclo de vida completo

```
login ──> emite RT#1 (hash no banco) + JWT#1
  15min depois, JWT expirou:
POST /auth/refresh (cookie RT#1)
  ├─ claim atômico: UPDATE …SET revokedAt WHERE id=RT#1 AND revokedAt IS NULL
  │    └─ count=1 → VENCEU → cria RT#2, emite JWT#2      (rotação)
  │    └─ count=0 → outra aba já rotacionou → 401 reuse  (sem duplicar tokens)
  RT#1 apresentado DE NOVO mais tarde (cookie roubado?):
  ├─ está revogado → REUSO DETECTADO → revoga TODOS os RT ativos do usuário
  └─ atacante e vítima são deslogados; a vítima loga de novo, o atacante não tem a senha
logout ──> revoga o RT atual + limpa o cookie
troca de senha ──> revoga TODOS os RT ativos (sessões antigas caem)
expurgo diário ──> apaga RT vencidos/revogados antigos (a tabela não cresce para sempre)
```

O **claim atômico** (update condicional dentro de transação) fecha uma corrida real: dois refresh
simultâneos com o mesmo token (duas abas) serializam no lock de linha do Postgres e só um vence —
sem isso, ambos passariam e a detecção de reuso viraria queijo suíço. Há teste de concorrência
disparando dois `rotate` em paralelo (`test/integration/session.test.ts`).

### 2.2 O trade-off do papel no claim

O JWT carrega `{ sub, role }`. Promover/rebaixar um usuário **só vale para tokens emitidos
depois** — um admin rebaixado continua admin por até 15 min (a vida do access token). Aceitamos o
trade-off pela statelessness (nenhuma consulta ao banco por request autenticado); a janela é
curta e o rebaixamento é evento raro. Se isso um dia importar: reduzir `JWT_EXPIRES` ou checar o
papel no banco apenas nas rotas ADMIN.

### 2.3 Cookies em cada topologia

- Mesma origem (Caddy/local): `SameSite=Lax` — o cookie nunca viaja para outros sites.
- Cross-site (Vercel + Render): `SameSite=None; Secure` obrigatório (navegador não envia
  cookie `Lax` em fetch cross-site). Controlado por `COOKIE_SAMESITE`, com `Secure` forçado no
  modo `none`. CSRF: o refresh só **emite** um novo access token que o atacante não consegue ler
  (SOP) — e as rotas de mutação exigem o header `Authorization`, que só o SPA legítimo tem.

## 3. Convites e reset (tokens de uso único)

Mesmo mecanismo para os dois (`purpose` distingue): 32 bytes aleatórios → o **hash** vai ao banco
com expiração de 72h; o valor puro vai **uma única vez** no link (`APP_URL/convite/<token>`).
Consumo marca `usedAt` (segunda tentativa falha). Reemissão invalida os pendentes do mesmo tipo.
Com SMTP configurado o link segue por e-mail; sem, o admin repassa manualmente — em ambos os
casos o servidor **nunca** persiste o token puro.

`POST /auth/password/forgot` responde `{ok:true}` **sempre** — exista ou não a conta — para não
servir de oráculo de e-mails cadastrados.

### 3.1 O teto das rotas com segredo é por IP

`AUTH_RATE_LIMIT_MAX` (padrão **10/min**) vale para login, aceite de convite e reset. O contador
é **por endereço IP**, não por conta — o que é o desenho certo contra força bruta distribuída,
mas tem uma consequência a considerar antes de publicar:

- **NAT compartilhado.** Um laboratório da universidade, um campus atrás de um único IP de saída
  ou uma rede móvel podem estourar 10 logins/minuto **coletivamente**, e aí alunos legítimos
  levam 429 sem terem feito nada de errado. Se a instância for exposta assim, avalie subir o
  teto e complementar com limite **por conta** (que é o que de fato barra força bruta dirigida).
- A própria suíte E2E esbarra nisso: ela faz ~15 logins em série do mesmo endereço, e por isso o
  job de E2E sobe `AUTH_RATE_LIMIT_MAX`. **Não afrouxe o valor em produção** — o padrão existe
  para valer lá.

## 4. Senhas

- **argon2id** com defaults da lib (memória 64MB, 3 iterações) — resistente a GPU.
- Mínimo de 10 caracteres (validado no cliente e no servidor).
- Cadastro público (RF-17) usa o mesmo caminho; instâncias fechadas desligam com
  `ALLOW_REGISTRATION=false` e ficam só no fluxo de convite.
- Troca de senha exige a senha atual e **revoga todas as sessões** (se alguém trocou a senha
  porque suspeita de comprometimento, as sessões do invasor caem junto).
- Timing: quando o e-mail não existe (login), rodamos `argon2.hash` mesmo assim — a resposta
  demora o mesmo que uma senha errada, e o tempo não denuncia contas existentes.

## 5. Autorização

Dois níveis, sempre no servidor:

1. **Papel** — `requireAuth`/`requireAdmin` (preHandlers tipados; o papel vem do claim).
2. **Posse** — toda rota `/me/*` resolve o recurso e compara `userId` com `req.user.sub`
   (`assertEnrollmentOwner`, `assertScenarioOwner`, `assertExtraOwner`). 404 para inexistente,
   403 para "existe mas não é seu". A UI esconder um botão **nunca** é controle de acesso.

Guardas anti-pé-no-próprio-pé do admin: não remove a própria conta, não rebaixa o próprio papel.

### 5.1 Superfícies com guarda extra

| Superfície | Guarda |
| --- | --- |
| `/admin/dev/*` (gerador de dados) | ADMIN **e** `DEV_TOOLS=true` **e** `NODE_ENV != production` — as três; em produção responde 403 mesmo com a flag ligada |
| `/docs` (OpenAPI) | desligada em produção por padrão (`DOCS_ENABLED` + `!isProd`) — expor a superfície inteira ajuda quem integra tanto quanto quem ataca |
| `/admin/metrics`, `/admin/audit` | ADMIN; métricas agregam por **rota padronizada** (`/me/enrollments/:id`), nunca por URL concreta, para não vazar identificadores |

## 6. Superfície HTTP

- **helmet** na API (headers padrão) + headers no edge (Caddy: HSTS, CSP restritiva, XFO,
  nosniff; Vercel: nosniff/XFO/referrer no `vercel.json`).
- **CORS** restrito às origens configuradas, com `credentials: true` (lista por vírgula).
- **Rate limit** por IP: global 120/min (configurável) e 10/min em `/auth/login`,
  `/auth/register`, `/auth/invite/accept`, `/auth/password/forgot`. Atrás de proxy,
  `TRUST_PROXY=true` garante que o IP limitado é o do cliente, não o do balanceador. Com
  réplicas, `REDIS_URL` muda o store para Redis (senão o limite efetivo multiplica por N).
- **Validação** zod em toda entrada; o handler de erro central mapeia
  Zod→400, posse→403/404, negócio (`AppError`)→status próprio, Prisma P2002→409/P2025→404,
  resto→500 **sem stack trace** (RNF-04).
- **Backpressure**: sob event loop/heap/RSS travados, o `under-pressure` devolve 503 com
  `Retry-After` em vez de aceitar trabalho que não consegue concluir.

## 7. Dados pessoais (LGPD)

Coleta mínima: nome, e-mail e dados acadêmicos que o próprio usuário insere. Exclusão de conta
remove tudo por cascade (enrollments → status/extras/cenários; tokens). Logs não registram
segredos (redaction) e o backup (RF-16) dá portabilidade dos dados ao titular.

### 7.1 Cifra de campo em repouso (AES-256-GCM)

TLS protege o dado **em trânsito** e o argon2 protege a senha (via única). Nenhum dos dois
protege um **dump do banco** — daí uma terceira camada para o dado que é PII e precisa ser lido
de volta: o número de matrícula.

- **Algoritmo**: AES-256-GCM (cifra autenticada: além de esconder, detecta adulteração).
- **Formato**: `v1:<iv>:<tag>:<dados>` em base64url. O prefixo de versão permite rotação de chave
  no futuro sem migração destrutiva.
- **Chave**: `FIELD_ENCRYPTION_KEY`, 32 bytes em base64 ou hex, resolvida **no boot** — chave
  malformada derruba o servidor na largada, não no meio de uma request.
- **Retrocompatível**: sem chave, o sistema opera transparente (grava em claro) e valores legados
  sem o prefixo passam direto. Instalações existentes não quebram ao atualizar.
- **Falha fechada, sem cascata**: chave errada ou dado adulterado devolvem `null` para aquele
  campo em vez de estourar — uma configuração ruim não derruba a listagem inteira de usuários.
- **Escrita e leitura em um lugar só**: `encryptField` na gravação e `toPublicUser` na leitura
  (usado por auth, `/me`, listagem do admin, seed e dev-tools).
- **A chave nunca vaza pela API**: `/admin/config` expõe apenas o booleano
  `security.fieldEncryption`.

### 7.1.1 A forma pública do usuário retira, não apenas seleciona

`toPublicUser` **remove** os campos privados (hoje, `passwordHash`) antes de devolver o objeto,
em vez de confiar que o chamador tenha pedido as colunas certas.

A distinção não é teórica: `publicUserSelect` existia desde o início, mas o login e o cadastro
buscavam o usuário com `findUnique` **sem `select`** — recebiam a linha inteira — e o mapper só
trocava a matrícula. O resultado é que `POST /auth/login` e `POST /auth/register` devolviam o
hash argon2 da senha dentro do JSON de resposta.

A lição que ficou no código: uma convenção ("lembre de usar o select certo") vale menos que uma
garantia ("o mapper retira"). O teste `nenhuma borda expõe o hash da senha`
(`test/integration/seguranca.test.ts`) cobre cadastro, login, `/me` e a listagem do admin de uma
vez, para que a regressão não volte por uma borda nova.

> ⚠️ **Perder a chave torna as matrículas já cifradas irrecuperáveis.** Guarde-a no cofre de
> segredos do provedor, junto do `JWT_SECRET`, e faça backup dela separado do backup do banco.

### 7.2 Trilha de auditoria

Ações sensíveis geram registro em `AuditLog` (quem, o quê, quando, IP): login e falha de login,
mudança de papel, importação de matriz, calendário acadêmico, avisos e uso das dev-tools. É
**best-effort por desenho** — se a gravação da auditoria falhar, ela nunca derruba a operação em
curso. O `meta` guarda só identificadores e contexto; segredos nunca entram ali.

## 8. Checklist de produção

- [ ] `NODE_ENV=production` (cookies `Secure`, logs `info`)
- [ ] `JWT_SECRET` forte (≥32 chars aleatórios) e fora do repositório
- [ ] HTTPS nas duas pontas (Render/Vercel dão; self-host → Caddy/Let's Encrypt)
- [ ] `COOKIE_SAMESITE` correto para a topologia (§2.3)
- [ ] `CORS_ORIGIN` sem curingas — origens explícitas
- [ ] `ALLOW_REGISTRATION` conforme a política da instância
- [ ] `FIELD_ENCRYPTION_KEY` definida (32 bytes) **e no cofre** — sem ela a matrícula fica em claro;
      perdê-la torna as já cifradas irrecuperáveis (§7.1)
- [ ] `DEV_TOOLS` ausente ou `false` (em produção o endpoint recusa de qualquer forma)
- [ ] `DOCS_ENABLED=false` se não quiser a API documentada publicamente
- [ ] Backup do banco agendado (`pg_dump` / snapshot do Neon) — e a chave de cifra guardada
      **separada** do backup, senão os dois vazam juntos
- [ ] Dependências: `npm audit` no CI de tempos em tempos
- [ ] `/admin/metrics` e `/health/pressure` sendo observados (latência p95/p99, 5xx, memória)

## 9. Operando uma instância pública (cadastro aberto)

Com `ALLOW_REGISTRATION=true` na internet, considere: o rate limit de 10/min em `/auth/register`
já freia criação em massa por IP, mas não impede contas de e-mails descartáveis — se virar
problema, feche o cadastro (`false`) e volte ao modo convite, ou coloque a instância atrás de
um proxy com desafio (Cloudflare). Revise `GET /admin/stats` periodicamente (contas e convites
pendentes anômalos são o primeiro sinal), mantenha **um** ADMIN de verdade (menos superfície) e
lembre que desmatricular/remover usuários apaga dados por cascade — exporte backup antes de
limpezas administrativas.

## 10. Reportando vulnerabilidades

Abra um *security advisory* privado no GitHub (Security → Advisories → New draft) em vez de uma
issue pública. Descreva o impacto e os passos de reprodução; corrigimos antes de divulgar.
