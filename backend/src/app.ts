// Fábrica da aplicação Fastify: plugins de segurança + módulos de rotas + erro centralizado.
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { securityPlugin } from "./plugins/security.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/routes.js";
import { userRoutes } from "./modules/users/routes.js";
import { courseRoutes } from "./modules/courses/routes.js";
import { progressRoutes } from "./modules/progress/routes.js";
import { extraRoutes } from "./modules/extras/routes.js";
import { scheduleRoutes, SigaaError } from "./modules/schedules/routes.js";
import { accountRoutes } from "./modules/account/routes.js";
import { OwnershipError } from "./lib/ownership.js";
import { AppError } from "./lib/errors.js";
import { env, isProd, docsEnabled } from "./env.js";
import { performancePlugin } from "./plugins/performance.js";
import { docsPlugin } from "./plugins/docs.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { metricsPlugin } from "./plugins/metrics.js";
import { observabilityRoutes } from "./modules/observability/routes.js";
import { plannerRoutes } from "./modules/planner/routes.js";
import { announcementRoutes } from "./modules/announcements/routes.js";
import { devToolsRoutes } from "./modules/devtools/routes.js";

export async function buildApp() {
  const app = Fastify({
    // atrás de proxy/CDN (Render, Caddy): respeita X-Forwarded-For para req.ip
    // (rate limit por IP correto) e X-Forwarded-Proto (cookies Secure).
    trustProxy: env.TRUST_PROXY === "true",
    logger: {
      level: isProd ? "info" : "debug",
      // RNF-10: nunca registrar segredos (Authorization, cookies, senhas, tokens) nos logs.
      redact: {
        paths: [
          "req.headers.authorization", "req.headers.cookie", "res.headers[\"set-cookie\"]",
          "*.password", "*.passwordHash", "*.token", "*.tokenHash", "*.accessToken",
        ],
        remove: true,
      },
    },
  });
  await app.register(securityPlugin);    // helmet + cors + rate limit (RNF-01..03)
  await app.register(performancePlugin); // compressão + ETag + backpressure
  await app.register(prismaPlugin);
  await app.register(authPlugin);        // jwt + decorators requireAuth/requireAdmin
  await app.register(metricsPlugin);     // observabilidade: contadores/latências em memória
  if (docsEnabled) await app.register(docsPlugin); // OpenAPI em /docs (fora de produção)

  // Erro centralizado: validação, posse e conflitos viram status claros; nada de stack trace (RNF-04).
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError)
      return reply.code(400).send({ error: "payload inválido", issues: err.issues });
    if (err instanceof OwnershipError || err instanceof AppError)
      return reply.code(err.status).send({ error: err.message });
    if (err instanceof SigaaError)
      return reply.code(400).send({ error: "código SIGAA inválido", tokens: err.errs });
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return reply.code(409).send({ error: "registro duplicado" });
      if (err.code === "P2025") return reply.code(404).send({ error: "registro não encontrado" });
    }
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: "erro interno" });
  });

  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes,    { prefix: "/auth" });
  await app.register(userRoutes,    { prefix: "/users" });      // admin (RF-01)
  await app.register(courseRoutes,  { prefix: "/courses" });
  await app.register(progressRoutes,{ prefix: "/me" });
  await app.register(extraRoutes,   { prefix: "/me" });
  await app.register(scheduleRoutes,{ prefix: "/me" });
  await app.register(accountRoutes, { prefix: "/me" });      // perfil, tema, backup (RF-15/16)
  await app.register(plannerRoutes, { prefix: "/me" });      // agenda + anotações (RF-25/26)
  await app.register(announcementRoutes);                    // avisos (RF-24): /announcements + /admin/announcements
  await app.register(adminRoutes,   { prefix: "/admin" });   // estatísticas e visão geral (RF-21)
  await app.register(observabilityRoutes, { prefix: "/admin" }); // métricas + auditoria (RF-27)
  await app.register(devToolsRoutes, { prefix: "/admin/dev" });  // gerador de massa (só DEV_TOOLS)
  return app;
}
