// RF-01/21 — administração de usuários (somente ADMIN). O admin cria o usuário SEM senha;
// o sistema gera um convite (enviado por e-mail quando SMTP configurado, RF-18) e o próprio
// usuário define a senha (RF-02). RF-21 amplia: troca de papel e gestão de matrículas.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issueInvite } from "../../lib/invite.js";
import { sendInviteEmail } from "../../lib/mailer.js";
import { stripUndefined } from "../../lib/strip.js";
import { audit } from "../../lib/audit.js";
import { toPublicUser } from "../../lib/userView.js";
import { encryptField } from "../../lib/fieldCrypto.js";

const newUserSchema = z.object({
  name: z.string().trim().min(2, "nome curto demais"),
  email: z.string().trim().email("e-mail inválido"),   // sem lowercase: o login compara exato
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  courseSlug: z.string().trim().min(1).optional(),  // matrícula inicial opcional
});
const IMPORT_MAX = 200;

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.requireAdmin }, async () => {
    const users = await app.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        matricula: true, shift: true,
        passwordHash: true, // usado só para derivar `active`; não é retornado
        enrollments: { select: { id: true, course: { select: { slug: true, name: true } } } },
      },
    });
    // v12: último login (trilha de auditoria) e sessões vivas por usuário — dados de CONTA,
    // que ajudam a achar convites esquecidos e contas abandonadas; nada acadêmico.
    const [logins, sessions] = await Promise.all([
      app.prisma.auditLog.groupBy({
        by: ["userId"], where: { action: "auth.login", userId: { not: null } }, _max: { createdAt: true },
      }),
      app.prisma.refreshToken.groupBy({
        by: ["userId"], where: { revokedAt: null, expiresAt: { gt: new Date() } }, _count: { _all: true },
      }),
    ]);
    const lastLogin = new Map(logins.map((l) => [l.userId, l._max.createdAt]));
    const liveSessions = new Map(sessions.map((s) => [s.userId, s._count._all]));
    return users.map(({ passwordHash, enrollments, ...u }) => ({
      ...toPublicUser(u),                          // decifra a matrícula (PII em repouso)
      active: passwordHash !== null,               // já definiu senha?
      courses: enrollments.map(e => ({ enrollmentId: e.id, ...e.course })),
      lastLoginAt: lastLogin.get(u.id) ?? null,
      sessions: liveSessions.get(u.id) ?? 0,
    }));
  });

  // Cria a conta sem senha + convite. Compartilhado entre o cadastro unitário e a importação.
  type NewUser = z.infer<typeof newUserSchema>;
  async function createWithInvite(body: NewUser, log: Parameters<typeof sendInviteEmail>[0]) {
    const exists = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return { ok: false as const, code: 409, error: "e-mail já cadastrado" };

    let courseId: string | undefined;
    if (body.courseSlug) {
      const course = await app.prisma.course.findFirst({
        where: { slug: body.courseSlug, deletedAt: null }, // curso na lixeira (RF-28) não matricula
      });
      if (!course) return { ok: false as const, code: 400, error: "curso inexistente" };
      courseId = course.id;
    }

    const user = await app.prisma.user.create({
      data: {
        name: body.name, email: body.email, role: body.role, passwordHash: null,
        ...(courseId ? { enrollments: { create: { courseId } } } : {}),
      },
    });
    const { link, expiresAt } = await issueInvite(app.prisma, user.id, "SET_PASSWORD");
    const emailed = await sendInviteEmail(log, user.email, link, "SET_PASSWORD");
    return {
      ok: true as const,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      invite: { link, expiresAt, emailed },        // link sempre disponível p/ repasse manual
    };
  }

  app.post("/", { preHandler: app.requireAdmin }, async (req, reply) => {
    const res = await createWithInvite(newUserSchema.parse(req.body), req.log);
    if (!res.ok) return reply.code(res.code).send({ error: res.error });
    return reply.code(201).send({ user: res.user, invite: res.invite });
  });

  // v12 — importação em lote (ex.: planilha da turma colada como CSV no frontend). Processa
  // linha a linha e devolve o resultado de cada uma: um e-mail repetido não derruba o lote.
  app.post("/import", { preHandler: app.requireAdmin }, async (req) => {
    const { users } = z.object({ users: z.array(z.unknown()).min(1).max(IMPORT_MAX) }).parse(req.body);
    const results: {
      row: number; email: string; status: "created" | "exists" | "error"; error?: string;
      invite?: { link: string; emailed: boolean };
    }[] = [];
    for (const [i, raw] of users.entries()) {
      const parsed = newUserSchema.safeParse(raw);
      const email = typeof (raw as { email?: unknown })?.email === "string" ? (raw as { email: string }).email : "";
      if (!parsed.success) {
        results.push({ row: i + 1, email, status: "error", error: parsed.error.issues[0]?.message ?? "linha inválida" });
        continue;
      }
      const res = await createWithInvite(parsed.data, req.log);
      if (res.ok) results.push({ row: i + 1, email: parsed.data.email, status: "created", invite: { link: res.invite.link, emailed: res.invite.emailed } });
      else results.push({ row: i + 1, email: parsed.data.email, status: res.code === 409 ? "exists" : "error", error: res.error });
    }
    const created = results.filter((r) => r.status === "created").length;
    await audit(app.prisma, {
      userId: req.user.sub, action: "user.import", entity: "User",
      meta: { rows: users.length, created }, ip: req.ip,
    });
    return { created, total: users.length, results };
  });

  // RF-21: editar papel/nome de um usuário. Protege contra remover o próprio ADMIN
  // (evita a instância ficar sem administrador por acidente).
  app.patch("/:id", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = z.object({
      role: z.enum(["ADMIN", "USER"]).optional(),
      name: z.string().min(2).optional(),
      // v12: dados de cadastro do aluno, como em Ajustes (matrícula vai cifrada para o banco)
      matricula: z.string().trim().max(30).transform((v) => v || null).nullable().optional(),
      shift: z.enum(["matutino", "vespertino", "noturno", "integral"]).nullable().optional(),
    }).strict().parse(req.body);
    if (id === req.user.sub && patch.role === "USER")
      return reply.code(400).send({ error: "não é possível rebaixar a própria conta" });
    try {
      const user = await app.prisma.user.update({
        where: { id },
        data: stripUndefined({
          ...patch,
          ...(patch.matricula !== undefined ? { matricula: encryptField(patch.matricula) } : {}),
        }),
        select: { id: true, name: true, email: true, role: true },
      });
      if (patch.name !== undefined || patch.matricula !== undefined || patch.shift !== undefined)
        await audit(app.prisma, {
          userId: req.user.sub, action: "user.update", entity: "User", entityId: id,
          // só QUAIS campos mudaram — a matrícula em si é PII e não vai para a trilha
          meta: { fields: Object.keys(stripUndefined({ name: patch.name, matricula: patch.matricula, shift: patch.shift })), target: user.email },
          ip: req.ip,
        });
      // mudança de papel é ação sensível — vai para a trilha de auditoria (RF-27)
      if (patch.role)
        await audit(app.prisma, {
          userId: req.user.sub, action: "user.role", entity: "User", entityId: id,
          meta: { role: patch.role, target: user.email }, ip: req.ip,
        });
      return user;
    } catch {
      return reply.code(404).send({ error: "usuário não encontrado" });
    }
  });

  // Reemitir convite (ou reset). Invalida convites do mesmo tipo ainda não usados.
  app.post("/:id/invite", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "usuário não encontrado" });

    const purpose = user.passwordHash ? "RESET_PASSWORD" : "SET_PASSWORD";
    await app.prisma.inviteToken.updateMany({
      where: { userId: id, purpose, usedAt: null },
      data: { usedAt: new Date() },                // invalida os pendentes do mesmo tipo
    });
    const { link, expiresAt } = await issueInvite(app.prisma, id, purpose);
    const emailed = await sendInviteEmail(req.log, user.email, link, purpose);
    return reply.send({ invite: { link, expiresAt, purpose, emailed } });
  });

  // v12 — encerra todas as sessões de uma conta (ex.: celular perdido, conta comprometida).
  // A própria conta usa Ajustes > Segurança, que preserva a sessão atual.
  app.post("/:id/sessions/revoke", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (id === req.user.sub)
      return reply.code(400).send({ error: "para a própria conta, use Ajustes > Segurança" });
    const user = await app.prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) return reply.code(404).send({ error: "usuário não encontrado" });
    const res = await app.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() },
    });
    await audit(app.prisma, {
      userId: req.user.sub, action: "user.sessions_revoke", entity: "User", entityId: id,
      meta: { revoked: res.count, target: user.email }, ip: req.ip,
    });
    return { revoked: res.count };
  });

  // RF-21: matricular usuário em um curso.
  app.post("/:id/enrollments", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { courseSlug } = z.object({ courseSlug: z.string() }).parse(req.body);
    const [user, course] = await Promise.all([
      app.prisma.user.findUnique({ where: { id } }),
      app.prisma.course.findFirst({ where: { slug: courseSlug, deletedAt: null } }), // RF-28
    ]);
    if (!user) return reply.code(404).send({ error: "usuário não encontrado" });
    if (!course) return reply.code(400).send({ error: "curso inexistente" });
    const enr = await app.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: id, courseId: course.id } },
      update: {},
      create: { userId: id, courseId: course.id },
    });
    return reply.code(201).send({ enrollmentId: enr.id, courseSlug });
  });

  // RF-21: desmatricular (remove o enrollment e, por cascade, status/extras/cenários dele).
  app.delete("/:id/enrollments/:enrollmentId", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id, enrollmentId } = z.object({ id: z.string(), enrollmentId: z.string() }).parse(req.params);
    const enr = await app.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enr || enr.userId !== id) return reply.code(404).send({ error: "matrícula não encontrada" });
    await app.prisma.enrollment.delete({ where: { id: enrollmentId } });
    return reply.code(204).send();
  });

  app.delete("/:id", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (id === req.user.sub) return reply.code(400).send({ error: "não é possível remover a própria conta" });
    try {
      const removed = await app.prisma.user.delete({ where: { id }, select: { email: true } }); // cascade
      await audit(app.prisma, {
        userId: req.user.sub, action: "user.delete", entity: "User", entityId: id,
        meta: { target: removed.email }, ip: req.ip,
      });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "usuário não encontrado" });
    }
  });
}
