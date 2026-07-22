// RF-15/16 — conta do próprio usuário: perfil, tema e backup JSON. Tudo escopado a req.user.sub.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { exportUser, importUser } from "../../lib/backup.js";
import { stripUndefined } from "../../lib/strip.js";
import { resolvePeriod } from "../../domain/period.js";
import { REFRESH_COOKIE } from "../../plugins/auth.js";
import { hashToken } from "../../lib/crypto.js";
import { audit } from "../../lib/audit.js";
import { publicUserSelect, toPublicUser } from "../../lib/userView.js";
import { encryptField } from "../../lib/fieldCrypto.js";
import { notFound } from "../../lib/errors.js";

export async function accountRoutes(app: FastifyInstance) {
  // Perfil do usuário autenticado (o frontend usa após login/refresh).
  // Inclui o período letivo GLOBAL (RF-20 v2): resolvido pelo calendário acadêmico agendado
  // pelos admins; sem calendário, cai na heurística de meses como sugestão.
  app.get("/", { preHandler: app.requireAuth }, async (req) => {
    const [user, calendar] = await Promise.all([
      app.prisma.user.findUnique({ where: { id: req.user.sub }, select: publicUserSelect }),
      app.prisma.academicPeriod.findMany({ orderBy: { startsAt: "asc" } }),
    ]);
    if (!user) throw notFound("usuário não encontrado");
    return { ...toPublicUser(user), period: resolvePeriod(calendar) };
  });

  // Troca de senha autenticada (exige a senha atual; revoga as outras sessões por segurança).
  app.post("/password", { preHandler: app.requireAuth }, async (req, reply) => {
    const { current, next } = z.object({
      current: z.string(), next: z.string().min(10),
    }).parse(req.body);
    const user = await app.prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, current)))
      return reply.code(401).send({ error: "senha atual incorreta" });
    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: user.id }, data: { passwordHash: await argon2.hash(next) },
      }),
      // revoga todos os refresh ativos: sessões antigas precisam logar de novo
      app.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() },
      }),
    ]);
    return reply.code(204).send();
  });

  // RF-15: perfil por usuário, persistido — tema, nome e dados acadêmicos (matrícula/turno).
  // `null` limpa o campo opcional; chave ausente não toca (semântica de PATCH via stripUndefined).
  app.patch("/settings", { preHandler: app.requireAuth }, async (req) => {
    const patch = z.object({
      theme: z.enum(["dark", "light"]).optional(),
      name: z.string().min(2).optional(),
      matricula: z.string().trim().max(30).transform((v) => v || null).nullable().optional(),
      shift: z.enum(["matutino", "vespertino", "noturno", "integral"]).nullable().optional(),
    }).strict().parse(req.body);
    // a matrícula é PII: vai CIFRADA para o banco (AES-256-GCM) e volta decifrada pelo mapper
    const data = stripUndefined({
      ...patch,
      ...(patch.matricula !== undefined ? { matricula: encryptField(patch.matricula) } : {}),
    });
    const saved = await app.prisma.user.update({
      where: { id: req.user.sub }, data, select: publicUserSelect,
    });
    return toPublicUser(saved);
  });

  // RF-16: exportar backup JSON dos próprios dados (download).
  app.get("/export", { preHandler: app.requireAuth }, async (req, reply) => {
    const data = await exportUser(app.prisma, req.user.sub);
    return reply
      .header("Content-Disposition", `attachment; filename="painel-backup-${Date.now()}.json"`)
      .send(data);
  });

  // RF-16: importar/reconstruir a partir de um backup JSON.
  app.post("/import", { preHandler: app.requireAuth }, async (req) => {
    return importUser(app.prisma, req.user.sub, req.body);
  });

  // Segurança: sessões ativas (refresh tokens vivos) do próprio usuário. Nunca devolve o token
  // nem seu hash — só metadados, para o usuário reconhecer e encerrar o que não for dele.
  app.get("/sessions", { preHandler: app.requireAuth }, async (req) => {
    const rows = await app.prisma.refreshToken.findMany({
      where: { userId: req.user.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return { sessions: rows, count: rows.length };
  });

  // Encerra TODAS as outras sessões (mantém a atual viva). Útil após suspeita de vazamento.
  app.post("/sessions/revoke-others", { preHandler: app.requireAuth }, async (req) => {
    const current = req.cookies[REFRESH_COOKIE];
    const currentRow = current
      ? await app.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(current) } })
      : null;
    const res = await app.prisma.refreshToken.updateMany({
      where: {
        userId: req.user.sub, revokedAt: null,
        ...(currentRow ? { id: { not: currentRow.id } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await audit(app.prisma, {
      userId: req.user.sub, action: "auth.revoke_others", meta: { revoked: res.count }, ip: req.ip,
    });
    return { revoked: res.count };
  });
}
