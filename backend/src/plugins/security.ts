// RNF-01 (headers), RNF-02 (CORS restrito), RNF-03 (rate limit).
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "../env.js";

export const securityPlugin = fp(async (app) => {
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });

  // Store do rate limit: em memória por padrão; com REDIS_URL, usa Redis (compartilhado entre
  // réplicas — sem isso o limite efetivo vira N×max e a proteção de brute-force enfraquece, RNF-07).
  let redis: import("ioredis").Redis | undefined;
  if (env.REDIS_URL) {
    const { default: Redis } = await import("ioredis");
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
