// RF-02/03/04 — convite, definição de senha, login, refresh, logout, reset.
// Hash de senha com argon2; tokens de convite/refresh armazenados só como hash (RNF-01).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { consumeInvite, issueInvite } from "../../lib/invite.js";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "../../lib/session.js";
import { REFRESH_COOKIE, refreshCookieOptions, type AccessClaims } from "../../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  const signAccess = (u: { id: string; role: "ADMIN" | "USER" }) =>
    app.jwt.sign({ sub: u.id, role: u.role } satisfies AccessClaims);

  // RNF-03: limite agressivo nas rotas que aceitam segredo (mitiga força bruta).
  const strict = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  // RF-02: usuário define a própria senha via token de convite (uso único).
  app.post("/invite/accept", strict, async (req, reply) => {
    const { token, password } = z.object({
      token: z.string().min(10), password: z.string().min(10),
    }).parse(req.body);

    const invite = await consumeInvite(app.prisma, token);
    if (!invite) return reply.code(400).send({ error: "convite inválido ou expirado" });

    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: invite.userId },
        data: { passwordHash: await argon2.hash(password) },
      }),
      app.prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    ]);
    return reply.code(204).send();
  });

  // RF-03: login -> access JWT (curto) + refresh opaco em cookie httpOnly.
  app.post("/login", strict, async (req, reply) => {
    const { email, password } = z.object({
      email: z.string().email(), password: z.string(),
    }).parse(req.body);

    const user = await app.prisma.user.findUnique({ where: { email } });
    // resposta uniforme: não revela se o e-mail existe nem se a senha ainda não foi definida
    if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, password)))
      return reply.code(401).send({ error: "credenciais inválidas" });

    const refresh = await issueRefreshToken(app.prisma, user.id);
    reply.setCookie(REFRESH_COOKIE, refresh, refreshCookieOptions());
    return reply.send({
      accessToken: signAccess(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme },
    });
  });

  // RF-03: rotação de refresh. Reuso detectado revoga a família e força novo login.
  app.post("/refresh", async (req, reply) => {
    const current = req.cookies[REFRESH_COOKIE];
    const result = await rotateRefreshToken(app.prisma, current);
    if (!result.ok) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      return reply.code(401).send({ error: "sessão expirada", reason: result.reason });
    }
    const user = await app.prisma.user.findUnique({ where: { id: result.userId } });
    if (!user) return reply.code(401).send({ error: "sessão expirada" });
    reply.setCookie(REFRESH_COOKIE, result.plain, refreshCookieOptions());
    return reply.send({ accessToken: signAccess(user) });
  });

  // Logout: revoga o refresh atual e limpa o cookie.
  app.post("/logout", async (req, reply) => {
    await revokeRefreshToken(app.prisma, req.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: "/auth" });
    return reply.code(204).send();
  });

  // RF-04: solicita reset. Resposta uniforme (não revela existência do e-mail).
  app.post("/password/forgot", strict, async (req, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await app.prisma.user.findUnique({ where: { email } });
    if (user) {
      const { link } = await issueInvite(app.prisma, user.id, "RESET_PASSWORD");
      // Sem serviço de e-mail na v1: em dev, logamos o link; em produção, enviar por e-mail.
      req.log.info({ resetLink: link, userId: user.id }, "link de reset gerado");
    }
    return reply.send({ ok: true });
  });
}
