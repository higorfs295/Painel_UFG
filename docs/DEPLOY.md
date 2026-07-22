# Deploy — do dev local ao ar por R$ 0

Este guia cobre **todas** as formas de rodar o Painel Acadêmico, da máquina local ao deploy
público em free tier. A topologia recomendada para acesso via web sem custo é:

> **API no Render (free) + frontend na Vercel (free) + Postgres no Neon (free permanente)**

O Neon resolve as duas piores dores do free do Render: o Postgres dele **expira em ~30 dias**
e não tem pooler; o Neon é permanente e tem **pooling embutido**. O único preço que sobra é a
**hibernação** do backend (o Render free dorme após ~15 min sem tráfego e acorda em ~30–60s no
primeiro request) — tolerável para uso pessoal.

---

## 1. Visão das topologias

| Topologia | Quando usar | TLS | Cookies |
| --- | --- | --- | --- |
| **Dev local** (Node no host + Postgres Docker) | desenvolvimento diário | não (http) | `lax` |
| **Docker Compose** (db+api+web+caddy) | testar a stack integrada / self-host numa VPS | Caddy (interno ou Let's Encrypt) | `lax` (mesma origem) |
| **Render + Vercel + Neon** | acesso público com custo zero | automático nas 3 plataformas | **`none`** (cross-site) |

A diferença crítica entre as duas últimas: no Compose tudo é **mesma origem** (o Caddy roteia
`/auth`, `/me`… para a API e o resto para o SPA), então o cookie de refresh viaja com
`SameSite=Lax`. No trio free, `app.vercel.app` e `api.onrender.com` são **origens diferentes** —
o cookie precisa de `SameSite=None; Secure`, e o CORS precisa permitir a origem do frontend.
Tudo isso é só configuração de ambiente (`COOKIE_SAMESITE`, `CORS_ORIGIN`) — o código é o mesmo.

---

## 2. Passo a passo: Neon (banco)

1. Crie a conta em **neon.tech** → *New Project* (região `aws-us-east-1` ou a mais próxima;
   Postgres 16+).
2. No dashboard do projeto, abra **Connection Details**. O Neon dá **duas** strings:
   - **Pooled connection** (host com `-pooler`) → será a `DATABASE_URL` do runtime;
   - **Direct connection** (sem `-pooler`) → será a `DIRECT_URL` das migrações.
3. Monte as URLs (troque `USER`, `PASS`, `HOST`):

```bash
# runtime (pooled — passa pelo PgBouncer do Neon; o Prisma exige o parâmetro pgbouncer=true)
DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15"

# migrações (direta — o migrate precisa de advisory locks que o pooler não suporta)
DIRECT_URL="postgresql://USER:PASS@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

> Por que duas? O PgBouncer em modo *transaction* não suporta *prepared statements* de longa
> vida nem os locks que `prisma migrate` usa. O schema declara `directUrl` justamente para o
> Prisma usar a conexão certa em cada situação — runtime pooled, migração direta.

O free do Neon dorme o *compute* após inatividade e acorda em ~1s — imperceptível na prática.

## 3. Passo a passo: Render (API)

O repositório traz um **blueprint** (`render.yaml`) que descreve o serviço. Duas opções:

**A) Via blueprint (recomendado):** dashboard do Render → *New → Blueprint* → aponte para o seu
fork do repositório. O Render lê o `render.yaml` e cria o serviço `painel-api`; ele vai pedir os
valores marcados `sync: false`:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | a string **pooled** do Neon (seção 2) |
| `DIRECT_URL` | a string **direta** do Neon |
| `APP_URL` | a URL do frontend na Vercel (ex.: `https://painel-ufg.vercel.app`) — **é a base dos links de convite/reset!** |
| `CORS_ORIGIN` | a mesma URL da Vercel (ou lista: `https://painel.vercel.app,https://painel-git-main-voce.vercel.app`) |
| `FIELD_ENCRYPTION_KEY` | **recomendado** — cifra a matrícula (PII) em repouso. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

(`JWT_SECRET` é gerado automaticamente; `COOKIE_SAMESITE=none` e `TRUST_PROXY=true` já vêm do
blueprint.)

**Sobre a chave de cifra:** sem ela o sistema funciona igual, só que a matrícula fica em claro no
banco. Definindo-a, os valores gravados a partir daí ficam cifrados (AES-256-GCM) e os antigos
continuam legíveis — a adoção é incremental. Depois de adotar, **guarde a chave no cofre**: perdê-la
torna as matrículas já cifradas irrecuperáveis. Não a coloque no mesmo lugar do backup do banco.

Duas variáveis que valem revisar antes de publicar:

| Variável | Padrão | Em produção |
| --- | --- | --- |
| `DOCS_ENABLED` | `true` | a documentação OpenAPI em `/docs` é **desligada automaticamente** quando `NODE_ENV=production`; deixe `false` também para não confiar só nisso |
| `DEV_TOOLS` | `false` | mantenha desligada — o gerador de dados fictícios recusa em produção mesmo se ligada, mas a flag não deveria existir lá |

**B) Manual:** *New → Web Service* → repo → Root Directory `backend` → Build
`npm ci && npx prisma generate && npm run build` → Start
`npx prisma migrate deploy && node dist/server.js` → Health check `/health` → e as env vars acima.

O `migrate deploy` no start é intencional: cada deploy aplica migrações pendentes (nunca cria
novas). Como o free hiberna, o *cold start* inclui essa checagem (rápida quando não há nada a
aplicar).

### 3.1 Semear o banco (uma vez)

O free do Render não tem shell. Semeie **da sua máquina**, apontando para o Neon:

```bash
cd backend
DATABASE_URL="<pooled do Neon>" DIRECT_URL="<direta do Neon>" \
SEED_ADMIN_PASSWORD='uma-senha-forte' npx tsx src/seed/seed.ts
```

(Ou registre-se pela UI com `ALLOW_REGISTRATION=true` e importe a matriz pelo painel admin —
mas aí a primeira conta precisa ser promovida a ADMIN direto no banco/console SQL do Neon:
`UPDATE "User" SET role='ADMIN' WHERE email='voce@...';`)

### 3.2 Mitigar a hibernação (opcional)

Um ping externo a cada ~10 min mantém o serviço acordado dentro das 750h/mês do free:
crie um monitor gratuito no **UptimeRobot**/**cron-job.org** apontando para
`https://sua-api.onrender.com/health`. Sem isso, o primeiro acesso do dia leva ~30–60s.

## 4. Passo a passo: Vercel (frontend)

1. Dashboard da Vercel → *Add New → Project* → importe o repo → **Root Directory: `frontend`**
   (a Vercel detecta Vite sozinha).
2. Em *Environment Variables*, defina **`VITE_API_URL`** = URL da API no Render
   (ex.: `https://painel-api.onrender.com`) — para Production e Preview.
3. Deploy. O `frontend/vercel.json` já cuida do fallback de SPA (toda rota → `index.html`)
   e de headers de segurança básicos.

> `VITE_API_URL` é **embutida no build** (não é lida em runtime): mudou a URL da API → redeploy
> do frontend. Os previews da Vercel têm URLs próprias — inclua-as no `CORS_ORIGIN` da API se
> quiser testar auth neles.

### 4.1 Amarrando as pontas (checklist final)

- [ ] `APP_URL` (Render) = URL da Vercel → links de convite/reset apontam para o site certo
- [ ] `CORS_ORIGIN` (Render) contém a URL da Vercel → o navegador aceita as respostas
- [ ] `COOKIE_SAMESITE=none` (Render) → o cookie de refresh viaja entre os domínios
- [ ] `VITE_API_URL` (Vercel) = URL do Render → o SPA fala com a API certa
- [ ] Teste: cadastro → login → recarregar a página (sessão persiste?) → convite de um segundo
      usuário chega/funciona?

## 5. Docker Compose (self-host / stack integrada)

```bash
cp .env.example .env               # defina JWT_SECRET (e POSTGRES_PASSWORD)
docker compose up --build -d       # db + api + web + caddy
docker compose run --rm -e SEED_ADMIN_PASSWORD='...' api npx tsx src/seed/seed.ts
# acesse http://localhost:8081 (ou https://localhost:8443 com o certificado interno do Caddy)
```

Notas desta topologia:

- As portas do host são **8081/8443** (80/8080 costumam estar ocupadas no Windows).
- `APP_URL`/`CORS_ORIGIN` têm default `http://localhost:8081` no compose — **se você expõe em
  outro endereço, defina-os no `.env`**, senão links de convite sairão errados (ver §7.1).
- Numa VPS com domínio: edite `deploy/Caddyfile` (troque `localhost` pelo domínio, remova
  `tls internal`) e o Caddy emite Let's Encrypt sozinho.
- Backup: `docker compose exec db pg_dump -U painel painel > backup-$(date +%F).sql` (agende).

## 6. E-mail de convite/reset (RF-18)

Sem SMTP configurado o sistema **funciona** — mas no modo manual: o link de convite é devolvido
ao admin (e logado no servidor) para repasse por WhatsApp/e-mail pessoal. Para envio automático:

```bash
SMTP_HOST="smtp.gmail.com"   # ou smtp.resend.com, smtp-relay.brevo.com…
SMTP_PORT=587
SMTP_USER="voce@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"   # Gmail: "senha de app" (exige 2FA ativado)
MAIL_FROM="Painel Acadêmico <voce@gmail.com>"
```

Opções gratuitas testadas pela comunidade: **Gmail** (senha de app; limite ~500/dia), **Resend**
(3k/mês; exige domínio verificado para FROM próprio), **Brevo** (300/dia). A falha de SMTP nunca
quebra o fluxo: o sistema loga o erro e o link continua disponível no painel admin.

## 7. Depois de publicar: o que observar

A instância expõe os próprios sinais — não é preciso montar stack de monitoramento para começar.

| Endpoint | Quem acessa | Para quê |
| --- | --- | --- |
| `GET /health` | público | *liveness* — é o health check do Render |
| `GET /health/pressure` | público | event loop, heap e RSS; devolve 503 quando o processo está sob pressão |
| `GET /admin/metrics` | ADMIN | contadores por classe de status, latências **p50/p95/p99**, rotas mais usadas e mais lentas, memória, uptime e ping do banco |
| `GET /admin/audit` | ADMIN | trilha de ações sensíveis (login, papéis, importações, calendário), filtrável por ação/usuário |

Na prática, três coisas dizem quase tudo nas primeiras semanas:

1. **p95 subindo** sem aumento de tráfego → normalmente é consulta sem índice ou banco hibernando;
   `db.pingMs` no mesmo payload separa um caso do outro.
2. **5xx > 0** → vá direto ao `/admin/audit` e aos logs do Render no mesmo horário.
3. **`rssMb` crescendo e não voltando** → vazamento; o `under-pressure` vai começar a devolver 503
   antes de o processo morrer, o que dá tempo de reiniciar.

O painel **Monitor** (`/admin/monitor`) lê exatamente esses dois endpoints, então dá para acompanhar
tudo pela própria interface. Para stacks externas (Prometheus/Grafana), o snapshot é JSON estável —
basta um *scraper* que traduza os campos.

## 8. Solução de problemas

### 8.1 "O convite não chega / o link do convite não abre" ⭐

O caso mais comum tem duas metades:

1. **"Não veio e-mail"** — até a RF-18, o sistema **não enviava** e-mail (por projeto): o link
   era devolvido ao admin para repasse manual. Agora envia **se** `SMTP_*` estiver configurado
   (§6); sem SMTP, o painel admin mostra "repasse o link" com o link na tela.
2. **"O link não abre / não consigo definir a senha"** — o link é montado com **`APP_URL`**.
   Rodando em Docker sem definir `APP_URL`, o default antigo era `http://localhost:5173`
   (a porta do Vite **de dev**, que não existe na stack containerizada!) → página inacessível.
   Confira: o link deve apontar para onde o **frontend** realmente está
   (`http://localhost:8081` no compose, URL da Vercel em produção).
   Outras causas: token **expirado** (72h) ou **já usado** (uso único) — reemita pelo painel;
   e senha com **menos de 10 caracteres** é recusada.

### 8.2 CORS bloqueando no trio free

`Access to fetch … has been blocked by CORS` → a origem do frontend não está em `CORS_ORIGIN`
da API. Lembre que preview da Vercel tem URL própria. Vírgula separa múltiplas origens.

### 8.3 Login funciona mas a sessão não sobrevive ao reload (cross-site)

Cookie de refresh não está indo. Verifique `COOKIE_SAMESITE=none` na API (e https em ambos os
lados — `None` exige `Secure`). No DevTools → Application → Cookies, o `rt` deve aparecer no
domínio da API com `SameSite=None`.

### 8.4 `prisma migrate` falha no Neon com timeout/lock

Está usando a URL **pooled** para migrar. Migração usa `DIRECT_URL` — confira que ela está
definida e **sem** `-pooler` no host.

### 8.5 `Environment variable not found: DIRECT_URL`

O schema declara `directUrl`. Em qualquer ambiente (dev local, CI, compose), defina `DIRECT_URL`
— localmente é **igual** à `DATABASE_URL` (o `.env.example` já traz).

### 8.6 Render dorme e o primeiro request falha no frontend

O fetch estoura timeout durante o *cold start*. Recarregue após ~30s ou configure o ping do
§3.2. (Melhoria futura: tela de "acordando o servidor…" com retry no cliente.)

### 8.7 Windows: `npm install` trava ou falha com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

Antivírus interceptando TLS (Avast et al.). Aponte o Node para o CA do próprio antivírus, sem
desligar verificação: `NODE_EXTRA_CA_CERTS="C:\ProgramData\Avast Software\Avast\wscert.pem"`.

### 8.8 Windows: variável de ambiente "some" ao rodar Playwright/np​x

O wrapper `npx.cmd` sob git-bash descarta prefixos `VAR=x`. Use
`node node_modules/@playwright/test/cli.js test …` (ou exporte no PowerShell).

## 9. Matriz de variáveis por ambiente

| Variável | Dev local | Compose | Render (free trio) |
| --- | --- | --- | --- |
| `DATABASE_URL` | Postgres Docker local | `db:5432` interno | **Neon pooled** (+`pgbouncer=true`) |
| `DIRECT_URL` | = DATABASE_URL | = DATABASE_URL | **Neon direta** |
| `APP_URL` | `http://localhost:5173` | `http://localhost:8081` | URL da **Vercel** |
| `CORS_ORIGIN` | `http://localhost:5173` | = APP_URL | URL da Vercel (lista ok) |
| `COOKIE_SAMESITE` | `lax` | `lax` | **`none`** |
| `TRUST_PROXY` | `true` | `true` | `true` |
| `ALLOW_REGISTRATION` | `true` | à sua escolha | à sua escolha |
| `SMTP_*` | opcional | opcional | recomendado (§6) |
| `JWT_SECRET` | ≥32 chars | `.env` | gerado pelo blueprint |
| `FIELD_ENCRYPTION_KEY` | opcional (sem ela, matrícula em claro) | opcional | **recomendado** — e no cofre |
| `DOCS_ENABLED` | `true` (`/docs`) | `true` | irrelevante: desliga sozinho em produção |
| `DEV_TOOLS` | `true` para gerar massa | `false` | **nunca** |
| `REDIS_URL` | — | opcional | recomendado com réplicas (rate limit compartilhado) |
