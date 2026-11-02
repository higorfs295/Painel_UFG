// RF-13 — catálogo de cursos (matriz, requisitos, marcos). Leitura para todos autenticados;
// escrita/importação de novas matrizes somente ADMIN (é assim que os próximos 2 cursos entram).
// RF-28 — lixeira: excluir um curso é irreversível para todos os alunos matriculados, então
// passa por duas etapas (lixeira -> expurgo), ambas exigindo confirmação explícita do slug.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { importCourse } from "../../domain/importCourse.js";
import { invalidateCourseGraph } from "../../domain/loadCourse.js";
import { exportCourse, previewImport } from "./matrix.js";
import { audit } from "../../lib/audit.js";
import {
  RETENTION_DAYS, courseImpact, listActiveCourses, listTrash,
  purgeCourse, restoreCourse, trashCourse,
} from "./service.js";

const slugParam = z.object({ slug: z.string().min(1) });
const idParam = z.object({ id: z.string().min(1) });
// a "segunda confirmação": o cliente reenvia o slug exato — digitar o nome é o gesto deliberado
const confirmBody = z.object({ confirm: z.string() });

export async function courseRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.requireAuth }, async () => listActiveCourses(app.prisma));

  // Lixeira (ADMIN). Vem ANTES de "/:slug" — senão "trash" seria capturado como slug.
  app.get("/trash", { preHandler: app.requireAdmin }, async () => ({
    retentionDays: RETENTION_DAYS,
    items: await listTrash(app.prisma),
  }));

  app.get("/:slug", { preHandler: app.requireAuth }, async (req, reply) => {
    const { slug } = slugParam.parse(req.params);
    const course = await app.prisma.course.findUnique({
      where: { slug },
      include: {
        requirements: true, milestones: true,
        subjects: { include: { requires: true }, orderBy: { seq: "asc" } },
      },
    });
    if (!course) return reply.code(404).send({ error: "curso não encontrado" });
    return course;
  });

  // Prévia do estrago: quantas matrículas/disciplinas/status um expurgo levaria.
  // A UI mostra estes números na primeira confirmação.
  app.get("/:slug/impact", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { slug } = slugParam.parse(req.params);
    const course = await app.prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!course) return reply.code(404).send({ error: "curso não encontrado" });
    return { retentionDays: RETENTION_DAYS, ...(await courseImpact(app.prisma, course.id)) };
  });

  // v12 — baixa a matriz no formato da importação (exportar → editar → reimportar).
  app.get("/:slug/export", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { slug } = slugParam.parse(req.params);
    const matriz = await exportCourse(app.prisma, slug);
    if (!matriz) return reply.code(404).send({ error: "curso não encontrado" });
    return reply.header("Content-Disposition", `attachment; filename="matriz-${slug}.json"`).send(matriz);
  });

  // v12 — nome e carga horária total editáveis na tela (o resto da matriz vem por importação).
  app.patch("/:slug", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { slug } = slugParam.parse(req.params);
    const patch = z.object({
      name: z.string().trim().min(3).max(160).optional(),
      totalHours: z.number().int().positive().max(20_000).optional(),
    }).strict().parse(req.body);
    const course = await app.prisma.course.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!course) return reply.code(404).send({ error: "curso não encontrado" });
    const updated = await app.prisma.course.update({
      where: { id: course.id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.totalHours !== undefined ? { totalHours: patch.totalHours } : {}),
      },
      select: { id: true, slug: true, name: true, totalHours: true },
    });
    invalidateCourseGraph(course.id); // totalHours entra no cálculo do progresso
    await audit(app.prisma, {
      userId: req.user.sub, action: "course.update", entity: "Course", entityId: slug, meta: patch, ip: req.ip,
    });
    return updated;
  });

  // RF-13: importa/atualiza matriz por JSON (mesmo formato do seed). Idempotente.
  // v12: `?dryRun=1` só valida e compara com o que existe — nada é gravado.
  app.post("/import", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { dryRun } = z.object({ dryRun: z.enum(["1", "true"]).optional() }).parse(req.query);
    if (dryRun) return previewImport(app.prisma, req.body);
    const result = await importCourse(app.prisma, req.body); // matrizSchema valida (zod) e lança em erro
    await audit(app.prisma, {
      userId: req.user.sub, action: "course.import", entity: "Course", entityId: result.slug,
      meta: { subjects: result.subjects }, ip: req.ip,
    });
    return reply.code(201).send(result);
  });

  // Etapa 1 — para a lixeira. Reversível por RETENTION_DAYS dias.
  app.delete("/:slug", { preHandler: app.requireAdmin }, async (req) => {
    const { slug } = slugParam.parse(req.params);
    const { confirm } = confirmBody.parse(req.body);
    const result = await trashCourse(app.prisma, slug, confirm);
    if (!result.alreadyTrashed) {
      await audit(app.prisma, {
        userId: req.user.sub, action: "course.trash", entity: "Course", entityId: result.id,
        meta: { slug, retentionDays: RETENTION_DAYS }, ip: req.ip,
      });
    }
    return { ...result, retentionDays: RETENTION_DAYS };
  });

  app.post("/trash/:id/restore", { preHandler: app.requireAdmin }, async (req) => {
    const { id } = idParam.parse(req.params);
    const restored = await restoreCourse(app.prisma, id);
    await audit(app.prisma, {
      userId: req.user.sub, action: "course.restore", entity: "Course", entityId: id,
      meta: { slug: restored.slug }, ip: req.ip,
    });
    return restored;
  });

  // Etapa 2 — expurgo definitivo (cascade). Exige o curso já na lixeira + slug de novo.
  app.delete("/trash/:id", { preHandler: app.requireAdmin }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { confirm } = confirmBody.parse(req.body);
    const purged = await purgeCourse(app.prisma, id, confirm);
    await audit(app.prisma, {
      userId: req.user.sub, action: "course.purge", entity: "Course", entityId: id,
      meta: { slug: purged.slug, ...purged.impact }, ip: req.ip,
    });
    return { purged: true, ...purged };
  });
}
