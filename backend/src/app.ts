// Fábrica da aplicação Fastify: plugins de segurança + módulos de rotas.
// Verifique a documentação oficial dos plugins @fastify/* — opções podem variar entre versões.
import Fastify from "fastify";
import { securityPlugin } from "./plugins/security.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/routes.js";
import { userRoutes } from "./modules/users/routes.js";
import { courseRoutes } from "./modules/courses/routes.js";
import { progressRoutes } from "./modules/progress/routes.js";
import { extraRoutes } from "./modules/extras/routes.js";
import { scheduleRoutes } from "./modules/schedules/routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(securityPlugin);   // helmet + cors + rate limit (RNF-01..03)
  await app.register(prismaPlugin);
  await app.register(authPlugin);       // jwt + decorators requireAuth/requireAdmin
  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes,    { prefix: "/auth" });
  await app.register(userRoutes,    { prefix: "/users" });      // admin (RF-01)
  await app.register(courseRoutes,  { prefix: "/courses" });
  await app.register(progressRoutes,{ prefix: "/me" });
  await app.register(extraRoutes,   { prefix: "/me" });
  await app.register(scheduleRoutes,{ prefix: "/me" });
  return app;
}
