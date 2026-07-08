# Backend API — build multi-stage. Debian slim (glibc) para compatibilidade com os engines
# do Prisma e o binário nativo do argon2 (evita compilar em Alpine/musl).
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
# normaliza fim de linha (defende contra CRLF vindo de checkout no Windows) e torna executável
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh
# roda como usuário não-root (RNF de segurança)
USER node
EXPOSE 3333
CMD ["./docker-entrypoint.sh"]