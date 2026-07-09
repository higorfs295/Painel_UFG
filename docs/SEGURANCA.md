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

## 6. Superfície HTTP

- **helmet** na API (headers padrão) + headers no edge (Caddy: HSTS, CSP restritiva, XFO,
  nosniff; Vercel: nosniff/XFO/referrer no `vercel.json`).
- **CORS** restrito às origens configuradas, com `credentials: true` (lista por vírgula).
- **Rate limit** por IP: global 120/min (configurável) e 10/min em `/auth/login`,
  `/auth/register`, `/auth/invite/accept`, `/auth/password/forgot`. Atrás de proxy,
  `TRUST_PROXY=true` garante que o IP limitado é o do cliente, não o do balanceador. Com
  réplicas, `REDIS_URL` muda o store para Redis (senão o limite efetivo multiplica por N).
- **Validação** zod em toda entrada; o handler de erro central mapeia
  Zod→400, posse→403/404, Prisma P2002→409/P2025→404, resto→500 **sem stack trace** (RNF-04).

## 7. Dados pessoais (LGPD)

Coleta mínima: nome, e-mail e dados acadêmicos que o próprio usuário insere. Exclusão de conta
remove tudo por cascade (enrollments → status/extras/cenários; tokens). Logs não registram
segredos (redaction) e o backup (RF-16) dá portabilidade dos dados ao titular.

## 8. Checklist de produção

- [ ] `NODE_ENV=production` (cookies `Secure`, logs `info`)
- [ ] `JWT_SECRET` forte (≥32 chars aleatórios) e fora do repositório
- [ ] HTTPS nas duas pontas (Render/Vercel dão; self-host → Caddy/Let's Encrypt)
- [ ] `COOKIE_SAMESITE` correto para a topologia (§2.3)
- [ ] `CORS_ORIGIN` sem curingas — origens explícitas
- [ ] `ALLOW_REGISTRATION` conforme a política da instância
- [ ] Backup do banco agendado (`pg_dump` / snapshot do Neon)
- [ ] Dependências: `npm audit` no CI de tempos em tempos

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
