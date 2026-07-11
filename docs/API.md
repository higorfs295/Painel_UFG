# Referência de API — Painel Acadêmico

Base (dev): `http://localhost:3333`. Em produção, mesma origem atrás do Caddy (`https://seu-dominio`)
ou cross-site (frontend na Vercel + API no Render — ver `DEPLOY.md`).
Autenticação por **Bearer token** no header `Authorization` (access token curto) + cookie `httpOnly`
de refresh. Todo payload é validado com zod; respostas de erro seguem um formato único.

## Convenções

- **Auth**: `público` (sem token), `autenticado` (qualquer usuário logado), `ADMIN`.
- **Formato de erro** (RNF-04, nunca vaza stack):
  ```json
  { "error": "payload inválido", "issues": [ { "path": ["email"], "message": "Invalid email" } ] }
  ```
- **Status usados**: `200/201/204` sucesso · `400` validação · `401` não autenticado · `403` sem
  permissão/posse · `404` inexistente · `409` conflito (duplicado) · `429` rate limit.
- **Rate limit**: global 120 req/min por IP; rotas com segredo (`/auth/login`, `/auth/register`,
  `/auth/invite/accept`, `/auth/password/forgot`) 10 req/min.
- Em requests **sem corpo** (DELETE etc.), não envie `Content-Type: application/json` — o Fastify
  rejeita corpo JSON vazio com 400.

---

## Autenticação — `/auth`

### POST /auth/register `público` (RF-17)
Cadastro público (auto-registro). Desligável por instância com `ALLOW_REGISTRATION=false`.
Autentica na resposta (mesmo shape do login).
```bash
curl -i -X POST http://localhost:3333/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana@ex.com","password":"senha-bem-forte"}'
```
`201` → `{ accessToken, user }` + cookie `rt` · `409` e-mail já cadastrado ·
`403 { "error": "cadastro público desabilitado nesta instância" }`.
Depois do cadastro, matricule-se com `POST /me/enrollments`.

### POST /auth/login `público`
```bash
curl -i -X POST http://localhost:3333/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"fhigor295@gmail.com","password":"sua-senha"}'
```
`200` → devolve o access token e seta o cookie `rt` (httpOnly):
```json
{ "accessToken": "eyJhbGc...",
  "user": { "id":"cuid","name":"Higor","email":"...","role":"ADMIN","theme":"dark" } }
```
`401 { "error": "credenciais inválidas" }` (resposta uniforme, sem revelar se o e-mail existe).

### POST /auth/refresh `público (cookie)`
Renova a sessão pelo cookie de refresh; **rotaciona** o token.
```bash
curl -X POST http://localhost:3333/auth/refresh --cookie 'rt=<valor>'
```
`200 { "accessToken": "..." }` + novo cookie `rt`. Reuso de um token já rotacionado →
`401 { "error":"sessão expirada", "reason":"reuse" }` e revoga a família.

### POST /auth/invite/accept `público`
O usuário define a própria senha (RF-02).
```bash
curl -X POST http://localhost:3333/auth/invite/accept \
  -H 'Content-Type: application/json' \
  -d '{"token":"<token-do-link>","password":"minha-senha-forte"}'
```
`204` sucesso · `400` token inválido/expirado/usado.

### POST /auth/logout `público (cookie)`
Revoga o refresh atual e limpa o cookie. `204`.

### POST /auth/password/forgot `público`
Gera um token de redefinição. Com SMTP configurado (RF-18), envia por e-mail; sem, o link fica
no log do servidor. Resposta uniforme (não revela se a conta existe):
```bash
curl -X POST http://localhost:3333/auth/password/forgot \
  -H 'Content-Type: application/json' -d '{"email":"user@ex.com"}'
```
`200 { "ok": true }` (sempre, exista ou não o e-mail).

---

## Usuários — `/users` `ADMIN`

### GET /users
Lista usuários com situação (senha definida?) e cursos (com o id da matrícula, para gestão).
```json
[ { "id":"...","name":"Ana","email":"...","role":"USER","active":false,
    "courses":[{"enrollmentId":"...","slug":"engcomp-ufg-2021","name":"Eng. de Computação"}] } ]
```

### POST /users
Cria usuário **sem senha** e devolve o link de convite (RF-01). Com SMTP configurado, o convite
também segue por e-mail (`emailed: true`).
```bash
curl -X POST http://localhost:3333/users -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana@ex.com","role":"USER","courseSlug":"engcomp-ufg-2021"}'
```
`201`:
```json
{ "user": { "id":"...","name":"Ana Souza","email":"ana@ex.com","role":"USER" },
  "invite": { "link":"http://localhost:5173/convite/<token>","expiresAt":"2026-07-12T...","emailed":false } }
```
`409` e-mail já cadastrado · `400` curso inexistente.

### PATCH /users/:id (RF-21)
Edita papel e/ou nome. `{ "role": "ADMIN" }` → `200`. `400` ao tentar rebaixar a própria conta.
Nota: o papel vive no claim do JWT — a mudança vale para tokens emitidos **depois** dela
(janela máxima = vida do access token, ~15 min; ver `SEGURANCA.md` §2.2).

### POST /users/:id/invite
Reemite convite (ou reset, se o usuário já tem senha). Invalida os pendentes do mesmo tipo.
`200 { invite: { link, expiresAt, purpose, emailed } }`.

### POST /users/:id/enrollments (RF-21)
Matricula o usuário num curso (idempotente). `{ "courseSlug": "engcomp-ufg-2021" }` →
`201 { enrollmentId, courseSlug }` · `400` curso inexistente · `404` usuário.

### DELETE /users/:id/enrollments/:enrollmentId (RF-21)
Desmatricula (⚠️ cascade apaga status/extras/cenários daquela matrícula). `204` · `404`.

### DELETE /users/:id
Remove o usuário (cascade). `204` · `400` se for a própria conta.

---

## Administração — `/admin` `ADMIN`

### GET /admin/stats (RF-21)
Números agregados da instância:
```json
{ "users": { "total": 12, "admins": 1, "pendingInvites": 3 },
  "courses": 2, "enrollments": 14,
  "activity": { "subjectStatuses": 310, "extras": 41, "scenarios": 9 } }
```

### Calendário acadêmico global (RF-20 v2) `ADMIN`
O período letivo corrente vale para **todos** e é resolvido de um calendário de *viradas*
agendáveis: em cada `startsAt` começa um `TERM` (com `term`, ex.: `2026.2`) ou um `BREAK`
(férias). O corrente = última entrada com `startsAt <= agora`; sem calendário, cai numa
heurística de meses.

- **GET /admin/periods** — `{ "entries": [...], "current": { "term","onBreak","label","nextTerm","source","nextStartsAt" } }`
- **POST /admin/periods** — agenda/atualiza uma virada (upsert por `startsAt`):
  ```bash
  curl -X POST http://localhost:3333/admin/periods -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -d '{"type":"BREAK","startsAt":"2026-07-06T00:00:00-03:00"}'
  curl -X POST http://localhost:3333/admin/periods -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -d '{"type":"TERM","term":"2026.2","startsAt":"2026-08-10T00:00:00-03:00"}'
  ```
  `201` entrada criada · `400` `TERM` sem `term` ou formato inválido · `403` não-admin.
- **DELETE /admin/periods/:id** — remove uma virada. `204`.

---

## Cursos — `/courses`

### GET /courses `autenticado`
`[ { "id","slug","name","totalHours" } ]`

### GET /courses/:slug `autenticado`
Curso completo com `requirements`, `milestones` e `subjects` (cada um com `requires`).

### POST /courses/import `ADMIN`
Importa/atualiza uma matriz (RF-13), mesmo formato do seed. Idempotente e transacional.
```bash
curl -X POST http://localhost:3333/courses/import -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d @matriz.json
```
`201 { "slug":"novo-curso","subjects":120 }`. Formato do JSON:
```json
{ "course": { "slug":"engcomp-ufg-2021", "name":"..." },
  "totalHours": 4132,
  "requirements": [ { "key":"NC","label":"Núcleo Comum","hours":1600 } ],
  "milestones":   [ { "key":"CH1","hours":1200,"description":"..." } ],
  "subjects": [
    { "seq":1,"code":"IME0351","name":"Álgebra Linear","hours":64,
      "nucleus":"NC","groupOpt":0,"pre":[],"co":[] },
    { "seq":2,"code":"...","name":"...","hours":64,"nucleus":"NE","groupOpt":0,
      "pre":[1],"co":["CH1"] }
  ] }
```
Em `pre`/`co`: número = `seq` de outra disciplina; string = `milestoneKey` (requisito por horas).

---

## Progresso — `/me` `autenticado`

### GET /me/enrollments
Matrículas do usuário logado (com o curso).
`[ { "id","courseId","startTerm","course":{...} } ]`

### POST /me/enrollments (RF-17)
Auto-matrícula em um curso do catálogo (idempotente). `{ "courseSlug": "..." }` → `201` com a
matrícula · `400` curso inexistente.

### PATCH /me/enrollments/:id (RF-20 v2)
Atualiza o **período de ingresso** (`startTerm`) da própria matrícula. Formato `AAAA.S`
validado; `null` limpa o campo. O período *corrente* saiu daqui — agora é global
(calendário do admin, ver `/admin/periods`); enviar `currentTerm` (ou qualquer chave extra)
é rejeitado com `400` (`.strict()`).
```bash
curl -X PATCH http://localhost:3333/me/enrollments/$ENR \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"startTerm":"2022.2"}'
```
`200` matrícula atualizada · `400 { issues: [...] }` formato/chave inválida · `403` de outro usuário.

### GET /me/enrollments/:id/progress
Progresso agregado numa leitura (RF-05):
```json
{ "enrollment": { "id":"...","courseId":"..." },
  "totals": { "hours":1460,"required":4132,"pct":35.3 },
  "compositions": [
    { "key":"NL","label":"Núcleo Livre","required":128,"hours":286,"pct":100,"over":158 }
  ],
  "subjects": [ { "seq":6,"code":"IME0080","name":"Cálculo 2A","hours":96,
                  "nucleus":"NC","groupOpt":0,"state":null,"status":"avail" } ],
  "milestones": [ { "key":"CH1","hours":1200,"description":"...","reached":true } ],
  "projected": { "totals":{"hours":1556,"required":4132}, "compositions":[...],
                 "milestones": { "CH1":true,"CH2":false } } }
```
Semântica dos números: `compositions[].hours` é o valor **real** (pode exceder o mínimo — o
excedente vai em `over` e a `pct` trava em 100); `totals.hours` soma as contribuições
**limitadas ao mínimo** de cada composição (regra do teto — `DOMINIO.md` §2.2).
`status` de cada disciplina: `done` (aprovada) · `avail` (disponível) · `co` (só falta co-requisito) ·
`lock` (bloqueada). `403` se o enrollment for de outro usuário.

### PUT /me/enrollments/:id/subjects/:subjectId
Marca a disciplina (RF-06/19). `state` = `"APPROVED"` (oficial) | `"ENROLLED"` (cursando) |
`"SIMULATED"` (planejada) | `null` (volta a pendente). Efeitos: só APPROVED soma no oficial;
os três somam na projeção; qualquer estado tira a disciplina das recomendações.
```bash
curl -X PUT http://localhost:3333/me/enrollments/$ENR/subjects/$SID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"state":"ENROLLED"}'
```
`200 { "subjectId","state" }` · `204` (quando `state:null`) · `400` disciplina de outro curso.

### GET /me/enrollments/:id/recommendations?limit=12
Ranking de disponíveis por destravamento (RF-07). Disciplinas já marcadas (qualquer estado)
não aparecem.
```json
[ { "seq":6,"code":"IME0080","name":"Cálculo 2A","hours":96,"ob":11,"tot":24 } ]
```
`ob` = obrigatórias destravadas · `tot` = total (transitivo).

---

## Extras — `/me` `autenticado` (posse do enrollment)

### GET /me/enrollments/:id/extras · POST /me/enrollments/:id/extras
```bash
curl -X POST http://localhost:3333/me/enrollments/$ENR/extras \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Internet das Coisas","code":"INF0423","hours":64,"category":"NL","done":true}'
```
`category`: `OPT` (optativa fora da matriz) · `NL` · `AC` · `NONE` (registro, não soma).
`done:false` = planejado (não soma no progresso).

### PATCH /me/extras/:extraId · DELETE /me/extras/:extraId
Edita/alterna `done` ou remove. `403/404` se não for do usuário.

---

## Cronograma — `/me` `autenticado` (posse)

### GET /me/enrollments/:id/scenarios
Cenários com `disciplines` e `paints`.

### POST /me/enrollments/:id/scenarios
Cria (ou duplica com `copyFrom`). `{ "name":"Plano A", "copyFrom":"<scenarioId>?" }` → `201`.

### PATCH /me/scenarios/:sid · DELETE /me/scenarios/:sid
Renomeia / exclui (cascade).

### POST /me/scenarios/:sid/disciplines
Adiciona disciplina; o código SIGAA é validado **no servidor** (RF-11).
```bash
curl -X POST http://localhost:3333/me/scenarios/$SID/disciplines \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Cálculo 2A","sigla":"CALC2","hours":96,"sigaaCode":"24M12","color":"#DB6B33"}'
```
`201 { ...disciplina, "slots":["2-M1","2-M2","4-M1","4-M2"] }` · `400 { "error":"código SIGAA inválido","tokens":["9M1"] }`.
Formato SIGAA: `24M12` = dias 2 e 4 (seg/qua), turno M (matutino), aulas 1 e 2.

### DELETE /me/scenarios/:sid/disciplines/:did
Remove. `204`.

### PUT /me/scenarios/:sid/paint
Pinta/limpa uma célula (RF-12). `category` vazia = remove.
```bash
curl -X PUT http://localhost:3333/me/scenarios/$SID/paint \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"cellKey":"2-M1","category":"estudo"}'
```

---

## Conta e backup — `/me` `autenticado`

### GET /me
Perfil do usuário logado + período letivo **global** (RF-20 v2), resolvido do calendário
acadêmico (ver `/admin/periods`); sem calendário, cai na heurística de meses:
```json
{ "id":"...", "name":"...", "email":"...", "role":"USER", "theme":"dark",
  "period": { "term":"2026.1", "onBreak":false, "label":"2026.1",
              "nextTerm":"2026.2", "source":"calendar", "nextStartsAt":"2026-07-06T03:00:00.000Z" } }
```
Em férias: `{ "term":null, "onBreak":true, "label":"Férias", "nextTerm":"2026.2", "source":"calendar" }`.
`source:"heuristic"` indica que ainda não há calendário cadastrado (o valor é uma sugestão).

### PATCH /me/settings
Tema (RF-15) e/ou nome. `{ "theme":"light" }` → `200` com o perfil atualizado.

### POST /me/password
Troca de senha autenticada. Exige a senha atual; **revoga todas as sessões** (os refresh tokens
ativos caem — outras abas/dispositivos precisam logar de novo).
```bash
curl -X POST http://localhost:3333/me/password -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current":"senha-antiga","next":"senha-nova-forte"}'
```
`204` sucesso · `401 { "error": "senha atual incorreta" }`.

### GET /me/export
Backup JSON completo do usuário (status, extras, cenários, tema), portável por `seq`.
```json
{ "version":1, "exportedAt":"...", "user":{"name","email","theme"},
  "enrollments":[ { "courseSlug","subjects":[{"seq","state"}],"extras":[...],"scenarios":[...] } ] }
```

### POST /me/import
Restaura um backup (RF-16), transacional. Cursos inexistentes no servidor são ignorados.
`200 { "restored":1, "skippedCourses":[] }`.

---

## Health

### GET /health `público`
`{ "ok": true }` — usado por orquestradores/uptime (e pelo ping anti-hibernação no Render).

---

## Fluxo completo em curl (do zero ao progresso)

Um passeio ponta a ponta pela API, útil para testar uma instância nova ou escrever um cliente
alternativo. Assume a API em `http://localhost:3333` e pelo menos um curso importado.

```bash
API=http://localhost:3333

# 1) Criar a própria conta (RF-17). O -c cookies.txt guarda o cookie de refresh.
curl -s -c cookies.txt -X POST $API/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maria Dev","email":"maria@ex.com","password":"senha-bem-forte"}' > login.json
TOKEN=$(python -c "import json;print(json.load(open('login.json'))['accessToken'])")

# 2) Ver o catálogo e se matricular (RF-17)
curl -s $API/courses -H "Authorization: Bearer $TOKEN"
curl -s -X POST $API/me/enrollments -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"courseSlug":"engcomp-ufg-2021"}' > enr.json
ENR=$(python -c "import json;print(json.load(open('enr.json'))['id'])")

# 3) Registrar o período de ingresso (RF-20 v2). O período corrente é global (admin) — ver /admin/periods.
curl -s -X PATCH $API/me/enrollments/$ENR -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"startTerm":"2022.2"}'

# 4) Descobrir o id de uma disciplina (o progresso traz seq; o curso mapeia seq->id)
SUBJ=$(curl -s $API/courses/engcomp-ufg-2021 -H "Authorization: Bearer $TOKEN" \
  | python -c "import json,sys; c=json.load(sys.stdin); \
      print(next(s['id'] for s in c['subjects'] if s['seq']==5))")   # Cálculo 1A

# 5) Marcar como CURSANDO (RF-19); quando o resultado sair, promover a APROVADA (RF-06)
curl -s -X PUT $API/me/enrollments/$ENR/subjects/$SUBJ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"state":"ENROLLED"}'
curl -s -X PUT $API/me/enrollments/$ENR/subjects/$SUBJ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"state":"APPROVED"}'

# 6) Um extra de Núcleo Livre concluído (RF-09)
curl -s -X POST $API/me/enrollments/$ENR/extras -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Libras","code":"FL0001","hours":64,"category":"NL","done":true}'

# 7) O progresso agregado (RF-05): somas com teto, marcos, projeção, recomendações
curl -s $API/me/enrollments/$ENR/progress -H "Authorization: Bearer $TOKEN" | python -m json.tool
curl -s "$API/me/enrollments/$ENR/recommendations?limit=5" -H "Authorization: Bearer $TOKEN"

# 8) Sessão: renovar o access token com o cookie (rotação) e sair
curl -s -b cookies.txt -c cookies.txt -X POST $API/auth/refresh
curl -s -b cookies.txt -X POST $API/auth/logout
```

Observações para quem consome a API:

- **Sempre** trate `401` re-tentando uma vez após `POST /auth/refresh` (o SPA faz isso em
  `api/client.ts`); se o refresh também der 401, a sessão morreu (reuso detectado ou expirou).
- Ids de banco (`subjectId`, `enrollmentId`) são cuids opacos; a identidade estável entre
  instâncias é `Course.slug` + `Subject.seq` (é assim que o backup viaja).
- Datas chegam como ISO-8601 UTC; percentuais já vêm travados em 100 (`pct`), com o valor real em
  `hours` e o excedente em `over`.
