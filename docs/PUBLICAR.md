# Roteiro de publicação

Como colocar uma instância no ar de graça: **Neon** (banco) + **Render** (API) + **Vercel**
(frontend). O passo 0 é do repositório; do 1 em diante é deploy.

A ordem importa: o SMTP fica por último de propósito, porque os links de convite embutem a
`APP_URL` — configurar e-mail antes de saber a URL final produz convites quebrados.

---

## Passo 0 — Preencher os dois placeholders

```bash
npm run preflight       # tipos, unitários, segredos, PII, coerência do alias, arquivos abertos
```

Ele falha de propósito enquanto faltarem:

- `LICENSE` → `<SEU NOME COMPLETO>`
- `SECURITY.md` → `<SEU E-MAIL DE CONTATO>`

Com `--full` inclui os testes de integração (exige Postgres migrado).

---

## Passo 1 — Limpar o histórico do git (`git filter-repo`)

Duas coisas de uma vez: a PII antiga e os `node_modules` commitados.

O `perfil-higor.json` **já saiu do código** (virou `perfil-exemplo.json`, fictício), mas
continua no histórico. E há **8.097 arquivos** de `node_modules` versionados em commits
antigos — é por isso que o `.git` pesa ~64 MB.

```bash
pip install git-filter-repo

# rede de segurança: um espelho completo antes de reescrever nada
git clone --mirror https://github.com/higorfs295/Painel_UFG.git backup-antes-do-filter.git

cd Painel_UFG
git filter-repo \
  --path backend/node_modules --path web/node_modules --path frontend/node_modules \
  --path node_modules --invert-paths \
  --path backend/src/seed/perfil-higor.json --invert-paths \
  --replace-text <(printf '%s\n' \
      'higor_ferreira@discente.ufg.br==>aluno@exemplo.com' \
      'fhigor295@gmail.com==>contato@exemplo.com' \
      'Higor Ferreira Silva==>Aluno Exemplo')

du -sh .git      # deve cair de ~64 MB para poucos MB
git remote add origin https://github.com/higorfs295/Painel_UFG.git
git push --force --all && git push --force --tags
```

**Antes de rodar, saiba:**

- O `filter-repo` reescreve **todos** os SHAs. Quem tiver um clone precisa clonar de novo.
  No momento em que isto foi escrito o repositório tinha **0 forks e 0 watchers**, então o
  estrago é mínimo — mas confira antes.
- O repositório **já é público**. O `filter-repo` limpa o seu remote, não os clones que
  terceiros já tenham feito nem os caches do GitHub. Para estes, peça a purga ao suporte do
  GitHub citando os SHAs.
- Uma varredura do histórico completo atrás de segredos reais (`JWT_SECRET`, `SMTP_PASS`,
  chaves de API, `DATABASE_URL` com credencial) **não encontrou nenhum** — só placeholders.

---

## Passo 2 — Neon (banco)

1. neon.tech → *New Project* → região mais próxima → Postgres 16+.
2. *Connection Details* → copie as **duas** strings:

```
DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.REGIAO.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASS@ep-xxx.REGIAO.aws.neon.tech/neondb?sslmode=require"
```

A **pooled** (com `-pooler`) é a do runtime; a **direta** é a das migrações. O Prisma precisa
das duas: o pooler não suporta os comandos DDL que a migração emite.

---

## Passo 3 — Render (API)

*New → Blueprint* apontando para o repositório. O `render.yaml` pede:

| Variável | Valor agora |
| --- | --- |
| `DATABASE_URL` | a pooled do Neon |
| `DIRECT_URL` | a direta do Neon |
| `FIELD_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `APP_URL` | `https://placeholder.vercel.app` (corrige no passo 5) |
| `CORS_ORIGIN` | idem |
| `SMTP_*` | **em branco por enquanto** |

`JWT_SECRET` é gerado pelo próprio Render. `COOKIE_SAMESITE=none`, `TRUST_PROXY=true`,
`DOCS_ENABLED=false`, `DEV_TOOLS=false` e `SMTP_PORT=2525` já vêm do blueprint.

> **Guarde a `FIELD_ENCRYPTION_KEY` num cofre, separada do backup do banco.** Perdê-la torna
> as matrículas já cifradas irrecuperáveis.

---

## Passo 4 — Semear o banco (da sua máquina)

O plano free do Render não tem shell, então o seed roda daqui:

```bash
cd backend
DATABASE_URL="<pooled do Neon>" \
DIRECT_URL="<direta do Neon>" \
FIELD_ENCRYPTION_KEY="<a MESMA do Render>" \
SEED_ADMIN_PASSWORD='uma-senha-forte-de-verdade' \
npx tsx src/seed/seed.ts
```

Chave diferente da que está no Render → as matrículas semeadas não decifram e vêm `null`.

---

## Passo 5 — Vercel (frontend) e fechar o ciclo

1. *Add New → Project* → importe o repo → **Root Directory: `web`**.
2. `NEXT_PUBLIC_API_URL` = a URL do Render (marque **Production e Preview**).
3. Deploy, anote a URL.
4. **Volte ao Render** e corrija `APP_URL` e `CORS_ORIGIN` para a URL da Vercel. Redeploy.

### Fumaça

```bash
npm run smoke -- https://painel-api.onrender.com https://sua-url.vercel.app
```

Cobre saúde, o alias `/api`, superfície fechada (`/docs`, devtools, rotas protegidas),
cabeçalhos e CORS com credenciais. O que só dá para ver no navegador:

- [ ] login com a conta do seed
- [ ] **recarregar a página mantém a sessão** — se cair, é o cookie: exige
      `COOKIE_SAMESITE=none` e HTTPS nos dois lados
- [ ] `/admin/config` mostra "SMTP não configurado" (esperado neste ponto)

---

## Passo 6 — SMTP

Agora sim, com a `APP_URL` correta.

1. Conta na Brevo (300 e-mails/dia, sem cartão).
2. **SMTP & API → SMTP**: gere uma *SMTP key* e copie o **login** mostrado ali — ele **não é
   necessariamente o e-mail da conta**, e confundir os dois é a causa clássica do `535 EAUTH`.
3. Verifique um remetente em **Senders**.
4. No Render:

```
SMTP_HOST = smtp-relay.brevo.com
SMTP_PORT = 2525
SMTP_USER = <o login do painel Brevo>
SMTP_PASS = <a SMTP key>
MAIL_FROM = Painel Acadêmico <remetente-verificado>
```

A porta **2525** não é capricho: o plano free do Render bloqueia a saída em 25, 465 e 587.

5. Redeploy → `/admin/config` → **Enviar e-mail de teste**.

| Resultado | Leitura |
| --- | --- |
| chegou | funcionou |
| `EAUTH` / `535` | credencial — revise `SMTP_USER` (é o login, não o e-mail) |
| `ETIMEDOUT` | a 2525 também está bloqueada → plano B por API HTTP |
| `550` | `MAIL_FROM` não verificado na Brevo |

**Sem SMTP o sistema continua funcionando**: o link de convite aparece na tela do admin para
repasse manual. Não é bloqueador para publicar.

---

## Depois (não é para o primeiro dia)

- [ ] Domínio próprio com DKIM na Brevo (entregabilidade)
- [ ] Monitor externo em `/health` a cada ~10 min contra a hibernação do free — pesando os
      ~5 GB/mês de banda de saída
- [ ] Trocar `'unsafe-inline'` do `script-src` por nonce em `middleware.ts` (o Caddyfile explica)
- [ ] Backup do Neon agendado e **com restauração testada**, não só gerado
- [ ] Se o cadastro aberto virar problema: `ALLOW_REGISTRATION=false` fecha a instância e o
      acesso passa a ser só por convite do admin
