// RNF-01 (headers), RNF-02 (CORS restrito), RNF-03 (rate limit).
// As opções abaixo são as usuais desses plugins, mas confirme na documentação da versão instalada.
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "../env.js";

export const securityPlugin = fp(async (app) => {
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW });
  // TODO: rate limit mais agressivo por rota em /auth/login e /auth/invite (config por rota do plugin)
});
