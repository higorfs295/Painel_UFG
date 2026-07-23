#!/usr/bin/env bash
# Verificações antes de publicar / abrir PR. Falha rápido e diz exatamente o que fazer.
#   ./scripts/preflight.sh          checagens que não precisam de banco
#   ./scripts/preflight.sh --full   inclui integração e E2E (exige Postgres no ar)
set -uo pipefail
cd "$(dirname "$0")/.."

FALHAS=0
ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
falha() { printf '  \033[31m✗\033[0m %s\n' "$1"; FALHAS=$((FALHAS+1)); }
aviso() { printf '  \033[33m!\033[0m %s\n' "$1"; }
secao() { printf '\n\033[1m%s\033[0m\n' "$1"; }

FULL=0
[ "${1:-}" = "--full" ] && FULL=1

secao "1. Tipos"
npm --prefix backend run typecheck --silent >/tmp/pf-be.log 2>&1 \
  && ok "backend" || { falha "backend — veja /tmp/pf-be.log"; tail -5 /tmp/pf-be.log; }
npm --prefix web run typecheck --silent >/tmp/pf-web.log 2>&1 \
  && ok "web" || { falha "web — veja /tmp/pf-web.log"; tail -5 /tmp/pf-web.log; }

secao "2. Testes unitários (sem banco)"
npm --prefix backend test --silent >/tmp/pf-unit.log 2>&1 \
  && ok "$(grep -oE '[0-9]+ passed' /tmp/pf-unit.log | tail -1)" \
  || { falha "unitários — veja /tmp/pf-unit.log"; tail -15 /tmp/pf-unit.log; }

secao "3. Segredos versionados"
PADRAO='(JWT_SECRET|SMTP_PASS|FIELD_ENCRYPTION_KEY|API_KEY|SECRET_KEY)[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9+/_=-]{16,}'
ACHOU=$(git grep -nIE "$PADRAO" -- ':!*.example' ':!*package-lock.json' ':!docs/*' 2>/dev/null \
        | grep -viE 'troque|exemplo|example|cole.aqui|placeholder|process\.env|z\.string|defina' || true)
[ -z "$ACHOU" ] && ok "nenhum segredo aparente no working tree" \
  || { falha "possíveis segredos versionados:"; echo "$ACHOU" | sed 's/^/      /'; }

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  falha ".env está VERSIONADO — remova com: git rm --cached .env"
else
  ok ".env fora do controle de versão"
fi

secao "4. PII no seed"
PII=$(git grep -nIE '@(gmail|hotmail|outlook|yahoo)\.com|@discente\.' -- ':!*.example' ':!*package-lock.json' 2>/dev/null || true)
[ -z "$PII" ] && ok "nenhum e-mail pessoal aparente" \
  || { aviso "e-mails pessoais encontrados (revise antes de publicar):"; echo "$PII" | sed 's/^/      /'; }

secao "5. Coerência do namespace duplo"
ALIAS_BE=$(grep -oP 'API_ALIAS_PREFIX: z\.string\(\)\.default\("\K[^"]*' backend/src/env.ts 2>/dev/null || echo '?')
if grep -q 'SAME_ORIGIN ? "/api"' web/src/lib/api/client.ts 2>/dev/null; then
  [ "$ALIAS_BE" = "/api" ] && ok "backend e cliente concordam em \"$ALIAS_BE\"" \
    || falha "backend usa \"$ALIAS_BE\" mas o cliente usa \"/api\" — devem bater"
else
  aviso "não consegui ler o prefixo do cliente; confira web/src/lib/api/client.ts"
fi
grep -q 'path /api/\*' deploy/Caddyfile 2>/dev/null \
  && ok "Caddyfile roteia /api/*" || falha "Caddyfile não roteia /api/* — a stack Docker vai quebrar"

secao "6. Arquivos de projeto aberto"
for f in LICENSE README.md SECURITY.md docs/CONTRIBUINDO.md .github/PULL_REQUEST_TEMPLATE.md; do
  [ -f "$f" ] && ok "$f" || falha "$f ausente"
done
[ -d web/public ] && ok "web/public existe (o COPY do Dockerfile depende disso)" \
  || falha "web/public ausente — docker compose up --build vai falhar"
grep -q '<SEU NOME COMPLETO>' LICENSE 2>/dev/null && falha "LICENSE ainda tem placeholder de nome"
grep -q '<SEU E-MAIL DE CONTATO>' SECURITY.md 2>/dev/null && falha "SECURITY.md ainda tem placeholder de e-mail"

if [ "$FULL" = "1" ]; then
  secao "7. Integração (precisa do Postgres migrado)"
  npm --prefix backend run test:integration --silent >/tmp/pf-int.log 2>&1 \
    && ok "$(grep -oE '[0-9]+ passed' /tmp/pf-int.log | tail -1)" \
    || { falha "integração — veja /tmp/pf-int.log"; tail -20 /tmp/pf-int.log; }
fi

secao "Resultado"
[ "$FALHAS" -eq 0 ] && { printf '  \033[32mtudo certo\033[0m\n\n'; exit 0; }
printf '  \033[31m%d falha(s)\033[0m\n\n' "$FALHAS"; exit 1
