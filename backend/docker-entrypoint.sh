#!/bin/sh
# Aplica migrações pendentes e sobe a API. Em produção use migrate deploy (não cria migration nova).
set -e
echo "→ aplicando migrations (prisma migrate deploy)…"
npx prisma migrate deploy
echo "→ iniciando API na porta 3333…"
exec node dist/server.js
