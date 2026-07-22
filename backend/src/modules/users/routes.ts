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
    return users.map(({ passwordHash, enrollments, ...u }) => ({
      ...toPublicUser(u),                          // decifra a matrícula (PII em repouso)
      active: passwordHash !== null,               // já definiu senha?
      courses: enrollments.map(e => ({ enrollmentId: e.id, ...e.course })),
    }));
  });

  app.post("/", { preHandler: app.requireAdmin }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(2), email: z.string().email(),
      role: z.enum(["ADMIN", "USER"]).default("USER"),
      courseSlug: z.string().optional(),           // matrícula inicial opcional
    }).parse(req.body);

    const exists = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return reply.code(409).send({ error: "e-mail já cadastrado" });

    let courseId: string | undefined;
    if (body.courseSlug) {
      const course = await app.prisma.course.findFirst({
        where: { slug: body.courseSlug, deletedAt: null }, // curso na lixeira (RF-28) não matricula
      });
      if (!course) return reply.code(400).send({ error: "curso inexistente" });
      courseId = course.id;
    }

    const user = await app.prisma.user.create({
      data: {
        name: body.name, email: body.email, role: body.role, passwordHash: null,
        ...(courseId ? { enrollments: { create: { courseId } } } : {}),
      },
    });
    const { link, expiresAt } = await issueInvite(app.prisma, user.id, "SET_PASSWORD");
    const emailed = await sendInviteEmail(req.log, user.email, link, "SET_PASSWORD");
    return reply.code(201).send({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      invite: { link, expiresAt, emailed },        // link sempre disponível p/ repasse manual
    });
  });

  // RF-21: editar papel/nome de um usuário. Protege contra remover o próprio ADMIN
  // (evita a instância ficar sem administrador por acidente).
  app.patch("/:id", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = z.object({
      role: z.enum(["ADMIN", "USER"]).optional(),
      name: z.string().min(2).optional(),
    }).parse(req.body);
    if (id === req.user.sub && patch.role === "USER")
      return reply.code(400).send({ error: "não é possível rebaixar a própria conta" });
    try {
      const user = await app.prisma.user.update({
        where: { id }, data: stripUndefined(patch),
        select: { id: true, name: true, email: true, role: true },
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
      await app.prisma.user.delete({ where: { id } }); // cascade remove enrollments/tokens
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "usuário não encontrado" });
    }
  });
}
