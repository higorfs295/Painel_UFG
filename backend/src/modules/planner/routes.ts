// RF-25/26 — planner pessoal: agenda de tarefas (provas, trabalhos, entregas) e anotações
// por disciplina. Tudo escopado ao dono do enrollment (RNF-05).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertEnrollmentOwner, assertTaskOwner } from "../../lib/ownership.js";
import { stripUndefined } from "../../lib/strip.js";

const taskSchema = z.object({
  title: z.string().min(2).max(160),
  kind: z.enum(["PROVA", "TRABALHO", "ENTREGA", "OUTRO"]).default("OUTRO"),
  dueAt: z.coerce.date().nullish(),
  done: z.boolean().default(false),
  notes: z.string().max(2000).nullish(),
  subjectCode: z.string().max(20).nullish(),
});

export async function plannerRoutes(app: FastifyInstance) {
  // ── Agenda (RF-25) ──
  app.get("/enrollments/:id/tasks", { preHandler: app.requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    // pendentes primeiro, por prazo; concluídas por último
    return app.prisma.studyTask.findMany({
      where: { enrollmentId: id },
      orderBy: [{ done: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });
  });

  app.post("/enrollments/:id/tasks", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = taskSchema.parse(req.body);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    const created = await app.prisma.studyTask.create({
      data: {
        enrollmentId: id, title: body.title, kind: body.kind, done: body.done,
        dueAt: body.dueAt ?? null, notes: body.notes ?? null, subjectCode: body.subjectCode ?? null,
      },
    });
    return reply.code(201).send(created);
  });

  app.patch("/tasks/:taskId", { preHandler: app.requireAuth }, async (req) => {
    const { taskId } = z.object({ taskId: z.string() }).parse(req.params);
    const patch = taskSchema.partial().parse(req.body);
    await assertTaskOwner(app.prisma, taskId, req.user.sub);
    return app.prisma.studyTask.update({ where: { id: taskId }, data: stripUndefined(patch) });
  });

  app.delete("/tasks/:taskId", { preHandler: app.requireAuth }, async (req, reply) => {
    const { taskId } = z.object({ taskId: z.string() }).parse(req.params);
    await assertTaskOwner(app.prisma, taskId, req.user.sub);
    await app.prisma.studyTask.delete({ where: { id: taskId } });
    return reply.code(204).send();
  });

  // ── Anotações por disciplina (RF-26) ──
  app.get("/enrollments/:id/notes", { preHandler: app.requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    const notes = await app.prisma.subjectNote.findMany({
      where: { enrollmentId: id },
      include: { subject: { select: { seq: true, code: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return notes.map((n) => ({
      subjectId: n.subjectId, seq: n.subject.seq, code: n.subject.code, name: n.subject.name,
      text: n.text, updatedAt: n.updatedAt,
    }));
  });

  app.put("/enrollments/:id/subjects/:subjectId/note", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id, subjectId } = z.object({ id: z.string(), subjectId: z.string() }).parse(req.params);
    const { text } = z.object({ text: z.string().max(4000) }).parse(req.body);
    const enr = await assertEnrollmentOwner(app.prisma, id, req.user.sub);

    const subject = await app.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.courseId !== enr.courseId)
      return reply.code(400).send({ error: "disciplina não pertence ao curso" });

    if (!text.trim()) { // texto vazio limpa a anotação (idempotente)
      await app.prisma.subjectNote.deleteMany({ where: { enrollmentId: id, subjectId } });
      return reply.code(204).send();
    }
    const saved = await app.prisma.subjectNote.upsert({
      where: { enrollmentId_subjectId: { enrollmentId: id, subjectId } },
      update: { text }, create: { enrollmentId: id, subjectId, text },
    });
    return reply.send({ subjectId: saved.subjectId, text: saved.text, updatedAt: saved.updatedAt });
  });

  app.delete("/enrollments/:id/subjects/:subjectId/note", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id, subjectId } = z.object({ id: z.string(), subjectId: z.string() }).parse(req.params);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    await app.prisma.subjectNote.deleteMany({ where: { enrollmentId: id, subjectId } });
    return reply.code(204).send();
  });
}
