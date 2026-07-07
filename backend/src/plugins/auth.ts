// JWT de acesso curto + refresh token opaco em cookie httpOnly (ver ESPECIFICACAO.md §8).
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: any;      // TODO: tipar como preHandler
    requireAdmin: any;
  }
}
export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET });
  app.decorate("requireAuth", async (req: any, reply: any) => {
    try { await req.jwtVerify(); } catch { return reply.code(401).send({ error: "não autenticado" }); }
  });
  app.decorate("requireAdmin", async (req: any, reply: any) => {
    try { await req.jwtVerify(); } catch { return reply.code(401).send({ error: "não autenticado" }); }
    if (req.user?.role !== "ADMIN") return reply.code(403).send({ error: "requer admin" });
  });
});
