// RF-15/16 — conta do próprio usuário: perfil, tema e backup JSON. Tudo escopado a req.user.sub.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { exportUser, importUser } from "../../lib/backup.js";
import { stripUndefined } from "../../lib/strip.js";

export async function accountRoutes(app: FastifyInstance) {
  // Perfil do usuário autenticado (o frontend usa após login/refresh).
  app.get("/", { preHandler: app.requireAuth }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true, theme: true, createdAt: true },
    });
    if (!user) return reply.code(404).send({ error: "usuário não encontrado" });
    return user;
  });

  // RF-15: tema (e nome) por usuário, persistido.
  app.patch("/settings", { preHandler: app.requireAuth }, async (req) => {
    const patch = z.object({
      theme: z.enum(["dark", "light"]).optional(),
      name: z.string().min(2).optional(),
    }).parse(req.body);
    return app.prisma.user.update({
      where: { id: req.user.sub }, data: stripUndefined(patch),
      select: { id: true, name: true, email: true, role: true, theme: true },
    });
  });

  // RF-16: exportar backup JSON dos próprios dados (download).
  app.get("/export", { preHandler: app.requireAuth }, async (req, reply) => {
    const data = await exportUser(app.prisma, req.user.sub);
    return reply
      .header("Content-Disposition", `attachment; filename="painel-backup-${Date.now()}.json"`)
      .send(data);
  });

  // RF-16: importar/reconstruir a partir de um backup JSON.
  app.post("/import", { preHandler: app.requireAuth }, async (req) => {
    return importUser(app.prisma, req.user.sub, req.body);
  });
}
