// RF-13 — catálogo de cursos (matriz, requisitos, marcos). Leitura para todos autenticados;
// escrita/importação de novas matrizes somente ADMIN (é assim que os próximos 2 cursos entram).
import type { FastifyInstance } from "fastify";
import { importCourse } from "../../domain/importCourse.js";
import { audit } from "../../lib/audit.js";

export async function courseRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.requireAuth }, async () =>
    app.prisma.course.findMany({ select: { id: true, slug: true, name: true, totalHours: true } }));

  app.get("/:slug", { preHandler: app.requireAuth }, async (req: any, reply) => {
    const course = await app.prisma.course.findUnique({
      where: { slug: req.params.slug },
      include: {
        requirements: true, milestones: true,
        subjects: { include: { requires: true }, orderBy: { seq: "asc" } },
      },
    });
    if (!course) return reply.code(404).send({ error: "curso não encontrado" });
    return course;
  });

  // RF-13: importa/atualiza matriz por JSON (mesmo formato do seed). Idempotente.
  app.post("/import", { preHandler: app.requireAdmin }, async (req, reply) => {
    const result = await importCourse(app.prisma, req.body); // matrizSchema valida (zod) e lança em erro
    await audit(app.prisma, {
      userId: req.user.sub, action: "course.import", entity: "Course", entityId: result.slug,
      meta: { subjects: result.subjects }, ip: req.ip,
    });
    return reply.code(201).send(result);
  });
}
