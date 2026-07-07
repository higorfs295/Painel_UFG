// RF-08/09 — componentes extras: optativas fora da matriz, Núcleo Livre, Atividades
// Complementares e registros (estágio, ligas, IC). CRUD restrito ao dono do enrollment.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertEnrollmentOwner, assertExtraOwner } from "../../lib/ownership.js";

const extraSchema = z.object({
  name: z.string().min(2), code: z.string().optional(),
  hours: z.number().int().min(0), category: z.enum(["OPT", "NL", "AC", "NONE"]),
  done: z.boolean().default(true),                 // planejado (false) não soma no progresso
});

export async function extraRoutes(app: FastifyInstance) {
  app.get("/enrollments/:id/extras", { preHandler: app.requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    return app.prisma.extraComponent.findMany({
      where: { enrollmentId: id }, orderBy: { createdAt: "asc" },
    });
  });

  app.post("/enrollments/:id/extras", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = extraSchema.parse(req.body);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    const created = await app.prisma.extraComponent.create({
      data: { enrollmentId: id, ...body, code: body.code ?? null },
    });
    return reply.code(201).send(created);
  });

  app.patch("/extras/:extraId", { preHandler: app.requireAuth }, async (req) => {
    const { extraId } = z.object({ extraId: z.string() }).parse(req.params);
    const patch = extraSchema.partial().parse(req.body);
    await assertExtraOwner(app.prisma, extraId, req.user.sub);
    return app.prisma.extraComponent.update({
      where: { id: extraId },
      data: { ...patch, ...(patch.code !== undefined ? { code: patch.code ?? null } : {}) },
    });
  });

  app.delete("/extras/:extraId", { preHandler: app.requireAuth }, async (req, reply) => {
    const { extraId } = z.object({ extraId: z.string() }).parse(req.params);
    await assertExtraOwner(app.prisma, extraId, req.user.sub);
    await app.prisma.extraComponent.delete({ where: { id: extraId } });
    return reply.code(204).send();
  });
}
