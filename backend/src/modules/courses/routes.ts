// RF-13 — catálogo de cursos (matriz, requisitos, marcos). Leitura para todos autenticados;
// escrita/importação de novas matrizes somente ADMIN (é assim que os próximos 2 cursos entram).
import type { FastifyInstance } from "fastify";

export async function courseRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.requireAuth }, async (req) =>
    app.prisma.course.findMany({ select: { id: true, slug: true, name: true, totalHours: true } }));
  app.get("/:slug", { preHandler: app.requireAuth }, async (req: any) =>
    app.prisma.course.findUnique({
      where: { slug: req.params.slug },
      include: { requirements: true, milestones: true,
        subjects: { include: { requires: true }, orderBy: { seq: "asc" } } } }));
  app.post("/import", { preHandler: app.requireAdmin }, async (req, reply) =>
    reply.code(501).send({ todo: "RF-13: importar JSON de matriz (mesmo formato do seed)" }));
}
