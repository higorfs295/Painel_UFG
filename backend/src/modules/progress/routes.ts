// RF-05/06/07 — progresso do usuário no curso: status por disciplina (oficial vs simulado),
// somas por composição com teto de exibição em 100% e recomendações por destravamento.
// O cálculo roda no servidor (fonte de verdade); a lógica de grafo vem de src/domain/*.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertEnrollmentOwner } from "../../lib/ownership.js";
import { stripUndefined } from "../../lib/strip.js";
import { loadCourseGraph } from "../../domain/loadCourse.js";
import { TERM_RE } from "../../domain/period.js";
import { computeProgress, recommend, type StatusRecord } from "../../domain/progress.js";

export async function progressRoutes(app: FastifyInstance) {
  app.get("/enrollments", { preHandler: app.requireAuth }, async (req) =>
    app.prisma.enrollment.findMany({
      where: { userId: req.user.sub },
      include: { course: { select: { slug: true, name: true, totalHours: true } } },
    }));

  // RF-17: auto-matrícula — quem se cadastrou sozinho escolhe o curso (idempotente).
  app.post("/enrollments", { preHandler: app.requireAuth }, async (req, reply) => {
    const { courseSlug } = z.object({ courseSlug: z.string() }).parse(req.body);
    const course = await app.prisma.course.findUnique({ where: { slug: courseSlug } });
    if (!course) return reply.code(400).send({ error: "curso inexistente" });
    const enr = await app.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.user.sub, courseId: course.id } },
      update: {},
      create: { userId: req.user.sub, courseId: course.id },
      include: { course: { select: { slug: true, name: true, totalHours: true } } },
    });
    return reply.code(201).send(enr);
  });

  // O usuário mantém apenas o startTerm (ingresso) da própria matrícula; o período corrente
  // é GLOBAL e vem do calendário acadêmico gerido pelos admins (RF-20 v2).
  app.patch("/enrollments/:id", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = z.object({
      startTerm: z.string().regex(TERM_RE, "formato AAAA.S (ex.: 2022.2)").nullable().optional(),
    }).strict().parse(req.body); // strict: rejeita currentTerm e afins — período corrente é global
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    const enr = await app.prisma.enrollment.update({
      where: { id },
      data: stripUndefined(patch), // null limpa; chave ausente não toca — semântica de PATCH
      include: { course: { select: { slug: true, name: true, totalHours: true } } },
    });
    return reply.send(enr);
  });

  // RF-05: somas por composição + status calculado por disciplina + marcos.
  app.get("/enrollments/:id/progress", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const enr = await assertEnrollmentOwner(app.prisma, id, req.user.sub);

    const graph = await loadCourseGraph(app.prisma, enr.courseId);
    if (!graph) return reply.code(404).send({ error: "curso do enrollment não encontrado" });

    const [statusRows, extras] = await Promise.all([
      app.prisma.subjectStatus.findMany({
        where: { enrollmentId: id }, include: { subject: { select: { seq: true } } },
      }),
      app.prisma.extraComponent.findMany({ where: { enrollmentId: id } }),
    ]);

    const statuses: StatusRecord[] = statusRows.map(s => ({ seq: s.subject.seq, state: s.state }));
    const progress = computeProgress({
      subjects: graph.subjects, milestones: graph.milestones, requirements: graph.requirements,
      statuses, extras, totalHours: graph.totalHours,
    });
    return { enrollment: { id: enr.id, courseId: enr.courseId }, ...progress };
  });

  // RF-06/19: marca disciplina — APPROVED (oficial), ENROLLED (cursando), SIMULATED
  // (planejamento) — ou volta a pendente (state = null).
  app.put("/enrollments/:id/subjects/:subjectId", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id, subjectId } = z.object({ id: z.string(), subjectId: z.string() }).parse(req.params);
    const { state } = z.object({ state: z.enum(["APPROVED", "SIMULATED", "ENROLLED"]).nullable() }).parse(req.body);
    const enr = await assertEnrollmentOwner(app.prisma, id, req.user.sub);

    // a disciplina precisa pertencer ao curso do enrollment
    const subject = await app.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.courseId !== enr.courseId)
      return reply.code(400).send({ error: "disciplina não pertence ao curso" });

    if (state === null) {
      await app.prisma.subjectStatus.deleteMany({ where: { enrollmentId: id, subjectId } });
      return reply.code(204).send();
    }
    const saved = await app.prisma.subjectStatus.upsert({
      where: { enrollmentId_subjectId: { enrollmentId: id, subjectId } },
      update: { state },
      create: { enrollmentId: id, subjectId, state },
    });
    return reply.send({ subjectId: saved.subjectId, state: saved.state });
  });

  // RF-07: ranking por destravamento transitivo (obrigatórias primeiro).
  app.get("/enrollments/:id/recommendations", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { limit } = z.object({ limit: z.coerce.number().int().positive().max(100).optional() }).parse(req.query);
    const enr = await assertEnrollmentOwner(app.prisma, id, req.user.sub);

    const graph = await loadCourseGraph(app.prisma, enr.courseId);
    if (!graph) return reply.code(404).send({ error: "curso do enrollment não encontrado" });

    const statusRows = await app.prisma.subjectStatus.findMany({
      where: { enrollmentId: id }, include: { subject: { select: { seq: true } } },
    });
    const statuses: StatusRecord[] = statusRows.map(s => ({ seq: s.subject.seq, state: s.state }));
    return recommend({
      subjects: graph.subjects, milestones: graph.milestones, requirements: graph.requirements, statuses,
      ...(limit !== undefined ? { limit } : {}),
    });
  });
}
