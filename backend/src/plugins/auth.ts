// JWT de acesso curto + refresh token opaco em cookie httpOnly (ver ESPECIFICACAO.md §8).
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { preHandlerHookHandler } from "fastify";
import { env, isProd, API_ALIAS_PREFIX } from "../env.js";

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

// Opções do cookie de refresh — httpOnly sempre. sameSite vem do ambiente:
//  - "lax" (padrão): mesma origem (Caddy) ou dev local;
//  - "none": deploy cross-site (ex.: frontend na Vercel + API no Render) — navegadores
//    exigem Secure junto, então secure é forçado nesse modo.
//
// O `path` NÃO é fixo: com o alias de namespace (ver app.ts) a mesma rota atende em
// `/auth/...` e em `/api/auth/...`. Um cookie gravado com path=/auth simplesmente não é
// enviado pelo navegador para /api/auth/refresh — a sessão morreria no primeiro refresh.
//
// `req.url` aqui já vem REESCRITO (sem o alias); o caminho original fica em
// `req.raw.originalUrl`, guardado pelo `rewriteUrl`. É de lá que sai a decisão.
type ReqComUrl = { url: string; raw?: unknown };

export function refreshCookiePath(req: ReqComUrl): string {
  const alias = API_ALIAS_PREFIX;
  if (!alias) return "/auth";
  const entrada = (req.raw as { originalUrl?: string } | undefined)?.originalUrl ?? req.url;
  return entrada.startsWith(`${alias}/auth`) ? `${alias}/auth` : "/auth";
}

export function refreshCookieOptions(req: ReqComUrl) {
  const sameSite = env.COOKIE_SAMESITE;
  return {
    httpOnly: true,
    secure: sameSite === "none" ? true : isProd,
    sameSite,
    path: refreshCookiePath(req),
    maxAge: env.REFRESH_EXPIRES_DAYS * 24 * 60 * 60, // segundos
  };
}
