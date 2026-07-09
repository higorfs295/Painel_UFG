// RNF-01 (headers), RNF-02 (CORS restrito), RNF-03 (rate limit).
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env, corsOrigins } from "../env.js";

export const securityPlugin = fp(async (app) => {
  await app.register(helmet);
  // CORS_ORIGIN aceita lista separada por vírgula (produção + previews do frontend).
  await app.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0]! : corsOrigins,
    credentials: true,
  });

  // Store do rate limit: em memória por padrão; com REDIS_URL, usa Redis (compartilhado entre
  // réplicas — sem isso o limite efetivo vira N×max e a proteção de brute-force enfraquece, RNF-07).
  let redis: import("ioredis").Redis | undefined;
  if (env.REDIS_URL) {
    const { Redis } = await import("ioredis"); // export nomeado: o default CJS não é construível sob nodenext
    redis = new Redis(env.REDIS_URL, { connectTimeout: 800, maxRetriesPerRequest: 1, lazyConnect: false });
    app.log.info("rate limit: usando store Redis");
  }
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    ...(redis ? { redis } : {}),
  });
  // Limite por rota mais agressivo (login/invite/reset) está em modules/auth/routes.ts via config.rateLimit.
});
