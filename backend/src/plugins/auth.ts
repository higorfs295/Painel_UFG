// JWT de acesso curto + refresh token opaco em cookie httpOnly (ver ESPECIFICACAO.md §8).
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { preHandlerHookHandler } from "fastify";
import { env, isProd } from "../env.js";

// claims que colocamos no access token
export type AccessClaims = { sub: string; role: "ADMIN" | "USER" };

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: preHandlerHookHandler;
    requireAdmin: preHandlerHookHandler;
  }
}
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessClaims;
    user: AccessClaims;
  }
}

export const REFRESH_COOKIE = "rt";

export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  // Access token trafega só no header Authorization (em memória no cliente).
  // O refresh opaco vai em cookie httpOnly, lido manualmente na rota /auth/refresh.
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES },
  });

  app.decorate("requireAuth", async (req, reply) => {
    try { await req.jwtVerify(); }
    catch { return reply.code(401).send({ error: "não autenticado" }); }
  });

  app.decorate("requireAdmin", async (req, reply) => {
    try { await req.jwtVerify(); }
    catch { return reply.code(401).send({ error: "não autenticado" }); }
    if (req.user.role !== "ADMIN") return reply.code(403).send({ error: "requer admin" });
  });
});

// opções do cookie de refresh — httpOnly + sameSite; secure só em produção (localhost é http).
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: env.REFRESH_EXPIRES_DAYS * 24 * 60 * 60, // segundos
  };
}
