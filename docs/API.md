# Referência de API — Painel Acadêmico

Base (dev): `http://localhost:3333`. Em produção, mesma origem atrás do Caddy (`https://seu-dominio`).
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
- **Rate limit**: global 120 req/min por IP; rotas com segredo (`/auth/login`, `/auth/invite/accept`,
  `/auth/password/forgot`) 10 req/min.

---

## Autenticação — `/auth`

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
Gera um token de redefinição (na v1, logado no servidor). Resposta uniforme:
```bash
curl -X POST http://localhost:3333/auth/password/forgot \
  -H 'Content-Type: application/json' -d '{"email":"user@ex.com"}'
```
`200 { "ok": true }` (sempre, exista ou não o e-mail).

---

## Usuários — `/users` `ADMIN`

### GET /users
Lista usuários com situação (senha definida?) e cursos.
```json
[ { "id":"...","name":"Ana","email":"...","role":"USER","active":false,
    "courses":[{"slug":"engcomp-ufg-2021","name":"Eng. de Computação"}] } ]
```

### POST /users
Cria usuário **sem senha** e devolve o link de convite (RF-01).
```bash
curl -X POST http://localhost:3333/users -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana@ex.com","role":"USER","courseSlug":"engcomp-ufg-2021"}'
```
`201`:
```json
{ "user": { "id":"...","name":"Ana Souza","email":"ana@ex.com","role":"USER" },
  "invite": { "link":"http://localhost:5173/convite/<token>","expiresAt":"2026-07-10T..." } }
```
`409` e-mail já cadastrado · `400` curso inexistente.

### POST /users/:id/invite
Reemite convite (ou reset). Invalida os pendentes do mesmo tipo. `200 { invite: {...} }`.

### DELETE /users/:id
Remove o usuário (cascade). `204` · `400` se for a própria conta.

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
Matrículas do usuário logado (com o curso). `[ { "id","courseId","course":{...} } ]`

### GET /me/enrollments/:id/progress
Progresso agregado numa leitura (RF-05):
```json
{ "enrollment": { "id":"...","courseId":"..." },
  "totals": { "hours":1737,"required":4132,"pct":42.0 },
  "compositions": [
    { "key":"NL","label":"Núcleo Livre","required":128,"hours":286,"pct":100,"over":158 }
  ],
  "subjects": [ { "seq":6,"code":"IME0080","name":"Cálculo 2A","hours":96,
                  "nucleus":"NC","groupOpt":0,"state":null,"status":"avail" } ],
  "milestones": [ { "key":"CH1","hours":1200,"description":"...","reached":true } ],
  "projected": { "totals":{"hours":1837,"required":4132}, "compositions":[...],
                 "milestones": { "CH1":true,"CH2":false } } }
```
`status` de cada disciplina: `done` (aprovada) · `avail` (disponível) · `co` (só falta co-requisito) ·
`lock` (bloqueada). `403` se o enrollment for de outro usuário.

### PUT /me/enrollments/:id/subjects/:subjectId
Marca a disciplina (RF-06). `state` = `"APPROVED"` | `"SIMULATED"` | `null` (volta a pendente).
```bash
curl -X PUT http://localhost:3333/me/enrollments/$ENR/subjects/$SID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"state":"APPROVED"}'
```
`200 { "subjectId","state" }` · `204` (quando `state:null`) · `400` disciplina de outro curso.

### GET /me/enrollments/:id/recommendations?limit=12
Ranking de disponíveis por destravamento (RF-07):
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
Perfil do usuário logado: `{ "id","name","email","role","theme","createdAt" }`.

### PATCH /me/settings
Tema (RF-15) e/ou nome. `{ "theme":"light" }` → `200` com o perfil atualizado.

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
`{ "ok": true }` — usado por orquestradores/uptime.
