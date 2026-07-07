// RF-01 — administração de usuários (somente ADMIN). O admin cria o usuário SEM senha;
// o sistema gera um convite e o próprio usuário define a senha (RF-02).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issueInvite } from "../../lib/invite.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.requireAdmin }, async () => {
    const users = await app.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        passwordHash: true, // usado só para derivar `active`; não é retornado
        enrollments: { select: { course: { select: { slug: true, name: true } } } },
      },
    });
    return users.map(({ passwordHash, enrollments, ...u }) => ({
      ...u,
      active: passwordHash !== null,               // já definiu senha?
      courses: enrollments.map(e => e.course),
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
      const course = await app.prisma.course.findUnique({ where: { slug: body.courseSlug } });
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
    return reply.code(201).send({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      invite: { link, expiresAt },
    });
  });

  // Reemitir convite (ou reset). Invalida convites SET_PASSWORD anteriores ainda não usados.
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
    return reply.send({ invite: { link, expiresAt, purpose } });
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
