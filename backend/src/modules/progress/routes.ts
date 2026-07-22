// RF-05/06/07/22/23 — progresso do usuário no curso. As rotas aqui são FINAS: validam a
// entrada, chamam o serviço e devolvem. Toda a orquestração (posse, grafo, status, extras) vive
// em ./service.ts e o cálculo em src/domain/* — o que mantém HTTP, negócio e regra separados.
import type { FastifyInstance } from "fastify";
import { assertEnrollmentOwner } from "../../lib/ownership.js";
import { stripUndefined } from "../../lib/strip.js";
import { badRequest } from "../../lib/errors.js";
import { idParam, paramOf } from "../../lib/schemas.js";
import { enrollBody, enrollmentPatch, subjectStatusBody, recommendationsQuery } from "./schemas.js";
import {
  loadEnrollmentContext, buildProgress, buildHistory, buildAchievements, buildRecommendations,
} from "./service.js";

const courseSelect = { course: { select: { slug: true, name: true, totalHours: true } } };
const subjectParams = idParam.merge(paramOf("subjectId"));

export async function progressRoutes(app: FastifyInstance) {
  app.get("/enrollments", { preHandler: app.requireAuth }, async (req) =>
    app.prisma.enrollment.findMany({
      where: { userId: req.user.sub },
      include: courseSelect,
    }));

  // RF-17: auto-matrícula — quem se cadastrou sozinho escolhe o curso (idempotente).
  app.post("/enrollments", { preHandler: app.requireAuth }, async (req, reply) => {
    const { courseSlug } = enrollBody.parse(req.body);
    // deletedAt: null — um curso na lixeira (RF-28) não aceita matrículas novas
    const course = await app.prisma.course.findFirst({ where: { slug: courseSlug, deletedAt: null } });
    if (!course) throw badRequest("curso inexistente");
    const enr = await app.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.user.sub, courseId: course.id } },
      update: {},
      create: { userId: req.user.sub, courseId: course.id },
      include: courseSelect,
    });
    return reply.code(201).send(enr);
  });

  // O usuário mantém apenas o startTerm (ingresso); o período corrente é GLOBAL (RF-20 v2).
  app.patch("/enrollments/:id", { preHandler: app.requireAuth }, async (req) => {
    const { id } = idParam.parse(req.params);
    const patch = enrollmentPatch.parse(req.body);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    return app.prisma.enrollment.update({
      where: { id },
      data: stripUndefined(patch), // null limpa; chave ausente não toca — semântica de PATCH
      include: courseSelect,
    });
  });

  // RF-05: somas por composição + status calculado por disciplina + marcos.
  app.get("/enrollments/:id/progress", { preHandler: app.requireAuth }, async (req) => {
    const { id } = idParam.parse(req.params);
    const ctx = await loadEnrollmentContext(app.prisma, id, req.user.sub);
    return { enrollment: ctx.enrollment, ...buildProgress(ctx) };
  });

  // RF-06/19/22: marca disciplina (aprovada/cursando/simulada) ou volta a pendente (state=null).
  // Aceita também nota, faltas e o período em que cursou.
  app.put("/enrollments/:id/subjects/:subjectId", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id, subjectId } = subjectParams.parse(req.params);
    const body = subjectStatusBody.parse(req.body);
    const enr = await assertEnrollmentOwner(app.prisma, id, req.user.sub);

    const subject = await app.prisma.subject.findUnique({
      where: { id: subjectId }, select: { courseId: true },
    });
    if (!subject || subject.courseId !== enr.courseId)
      throw badRequest("disciplina não pertence ao curso");

    if (body.state === null) {
      await app.prisma.subjectStatus.deleteMany({ where: { enrollmentId: id, subjectId } });
      return reply.code(204).send();
    }
    const detail = stripUndefined({ grade: body.grade, absences: body.absences, term: body.term });
    const saved = await app.prisma.subjectStatus.upsert({
      where: { enrollmentId_subjectId: { enrollmentId: id, subjectId } },
      update: { state: body.state, ...detail },
      create: { enrollmentId: id, subjectId, state: body.state, ...detail },
      select: { subjectId: true, state: true, grade: true, absences: true, term: true },
    });
    return saved;
  });

  // RF-22/23: histórico por período (CH + médias ponderadas), MGA e ritmo de formatura.
  app.get("/enrollments/:id/history", { preHandler: app.requireAuth }, async (req) => {
    const { id } = idParam.parse(req.params);
    return buildHistory(await loadEnrollmentContext(app.prisma, id, req.user.sub));
  });

  // RF-23: conquistas (gamificação leve) — derivadas, nunca persistidas.
  app.get("/enrollments/:id/achievements", { preHandler: app.requireAuth }, async (req) => {
    const { id } = idParam.parse(req.params);
    const [ctx, scenarios] = await Promise.all([
      loadEnrollmentContext(app.prisma, id, req.user.sub),
      app.prisma.scenario.count({ where: { enrollmentId: id } }),
    ]);
    return buildAchievements(ctx, scenarios);
  });

  // RF-07: ranking por destravamento transitivo (obrigatórias primeiro).
  app.get("/enrollments/:id/recommendations", { preHandler: app.requireAuth }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { limit } = recommendationsQuery.parse(req.query);
    const ctx = await loadEnrollmentContext(app.prisma, id, req.user.sub);
    return buildRecommendations(ctx, limit);
  });
}
