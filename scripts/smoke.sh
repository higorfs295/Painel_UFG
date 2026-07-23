#!/usr/bin/env bash
# Fumaça contra uma instância já publicada. Não escreve nada: só GET e OPTIONS.
#
#   ./scripts/smoke.sh https://painel-api.onrender.com https://painel.vercel.app
#
# O primeiro argumento é a API; o segundo (opcional) é o frontend, usado para
# conferir o CORS. Sem argumentos, testa a stack local do docker-compose.
set -uo pipefail

API="${1:-http://localhost:8081}"
WEB="${2:-}"
FALHAS=0

ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
falha() { printf '  \033[31m✗\033[0m %s\n' "$1"; FALHAS=$((FALHAS+1)); }
aviso() { printf '  \033[33m!\033[0m %s\n' "$1"; }

# $1 método, $2 caminho, $3 status esperado (regex), $4 descrição
checa() {
  local codigo
  codigo=$(curl -s -o /tmp/smoke-body -w '%{http_code}' -X "$1" --max-time 90 "$API$2" 2>/dev/null)
  if [[ "$codigo" =~ $3 ]]; then ok "$4 ($codigo)"; else falha "$4 — esperava $3, veio $codigo"; fi
}

printf '\n\033[1mAPI:\033[0m %s\n' "$API"
[ -n "$WEB" ] && printf '\033[1mWeb:\033[0m %s\n' "$WEB"

printf '\n\033[1m1. Saúde\033[0m\n'
printf '  (o plano free do Render hiberna: a primeira chamada pode levar 30-60s)\n'
checa GET /health '^200$' 'GET /health'
grep -q '"ok":true' /tmp/smoke-body 2>/dev/null && ok 'corpo é {"ok":true}' || falha 'corpo inesperado'

printf '\n\033[1m2. Namespace duplo\033[0m\n'
checa GET /api/health '^200$' 'GET /api/health (alias)'

printf '\n\033[1m3. Superfície fechada em produção\033[0m\n'
checa GET /docs '^(404|403|401)$' '/docs desligada'
checa GET /admin/stats '^401$' '/admin/stats exige auth'
checa GET /me/progress '^401$' '/me/* exige auth'
checa POST /admin/dev/seed '^(401|403|404)$' 'devtools fechada'

printf '\n\033[1m4. Cabeçalhos de segurança\033[0m\n'
HDR=$(curl -s -I --max-time 60 "$API/health" 2>/dev/null | tr 'A-Z' 'a-z')
for h in x-content-type-options x-frame-options; do
  grep -q "^$h:" <<<"$HDR" && ok "$h presente" || aviso "$h ausente"
done
grep -q '^strict-transport-security:' <<<"$HDR" && ok 'HSTS presente' \
  || aviso 'HSTS ausente (o Render termina o TLS; confira se é esperado)'

if [ -n "$WEB" ]; then
  printf '\n\033[1m5. CORS para o frontend\033[0m\n'
  CORS=$(curl -s -I --max-time 60 -X OPTIONS "$API/auth/login" \
         -H "Origin: $WEB" -H 'Access-Control-Request-Method: POST' 2>/dev/null | tr 'A-Z' 'a-z')
  if grep -q "access-control-allow-origin:.*$(tr 'A-Z' 'a-z' <<<"$WEB")" <<<"$CORS"; then
    ok 'origem liberada'
  else
    falha "origem NÃO liberada — ajuste CORS_ORIGIN no Render para $WEB"
  fi
  grep -q 'access-control-allow-credentials: *true' <<<"$CORS" \
    && ok 'credentials permitido (necessário para o cookie de refresh)' \
    || falha 'allow-credentials ausente — a sessão não vai persistir'

  printf '\n\033[1m6. Frontend\033[0m\n'
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$WEB" 2>/dev/null)
  [ "$CODIGO" = "200" ] && ok "landing responde ($CODIGO)" || falha "landing veio $CODIGO"
fi

printf '\n\033[1mResultado\033[0m\n'
if [ "$FALHAS" -eq 0 ]; then
  printf '  \033[32mfumaça limpa\033[0m\n'
  printf '  Falta o que só dá para testar no navegador: login, F5 mantendo a sessão,\n'
  printf '  e o botão de e-mail de teste em /admin/config.\n\n'
  exit 0
fi
printf '  \033[31m%d falha(s)\033[0m\n\n' "$FALHAS"; exit 1
