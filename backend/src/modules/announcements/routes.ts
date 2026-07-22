// RF-24 — avisos/comunicados da instância. Leitura para qualquer autenticado (filtrada por
// audiência conforme o papel); gestão somente ADMIN. Registrado SEM prefixo (caminhos completos).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { stripUndefined } from "../../lib/strip.js";

const bodySchema = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(1).max(4000),
  audience: z.enum(["ALL", "STUDENTS", "ADMINS"]).default("ALL"),
  pinned: z.boolean().default(false),
});

export async function announcementRoutes(app: FastifyInstance) {
  // Feed de avisos do usuário logado: fixados primeiro, depois mais recentes.
  app.get("/announcements", { preHandler: app.requireAuth }, async (req) => {
    const q = z.object({ limit: z.coerce.number().int().positive().max(50).default(20) }).parse(req.query);
    const forRole = req.user.role === "ADMIN" ? ["ALL", "ADMINS"] : ["ALL", "STUDENTS"];
    return app.prisma.announcement.findMany({
      where: { audience: { in: forRole as ("ALL" | "STUDENTS" | "ADMINS")[] } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: q.limit,
      include: { author: { select: { name: true } } },
    });
  });

  // Gestão (ADMIN) — o admin lista TODOS (inclusive os só-de-alunos) para gerir.
  app.get("/admin/announcements", { preHandler: app.requireAdmin }, async () =>
    app.prisma.announcement.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: { author: { select: { name: true } } },
    }));

  app.post("/admin/announcements", { preHandler: app.requireAdmin }, async (req, reply) => {
    const body = bodySchema.parse(req.body);
    const created = await app.prisma.announcement.create({
      data: { ...body, authorId: req.user.sub },
    });
    await audit(app.prisma, {
      userId: req.user.sub, action: "announcement.create", entity: "Announcement",
      entityId: created.id, meta: { title: body.title, audience: body.audience }, ip: req.ip,
    });
    return reply.code(201).send(created);
  });

  app.patch("/admin/announcements/:id", { preHandler: app.requireAdmin }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = bodySchema.partial().parse(req.body);
    return app.prisma.announcement.update({ where: { id }, data: stripUndefined(patch) });
  });

  app.delete("/admin/announcements/:id", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await app.prisma.announcement.delete({ where: { id } });
    await audit(app.prisma, {
      userId: req.user.sub, action: "announcement.delete", entity: "Announcement", entityId: id, ip: req.ip,
    });
    return reply.code(204).send();
  });
}
