// RF-08/09 — componentes extras: optativas fora da matriz, Núcleo Livre, Atividades
// Complementares e registros (estágio, ligas, IC). CRUD restrito ao dono do enrollment.
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const extraSchema = z.object({
  name: z.string().min(2), code: z.string().optional(),
  hours: z.number().int().min(0), category: z.enum(["OPT","NL","AC","NONE"]),
  done: z.boolean().default(true),
});
export async function extraRoutes(app: FastifyInstance) {
  app.get("/enrollments/:id/extras",    { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "listar" }));
  app.post("/enrollments/:id/extras",   { preHandler: app.requireAuth }, async (req, reply) => {
    extraSchema.parse(req.body);
    return reply.code(501).send({ todo: "criar" });
  });
  app.patch("/extras/:extraId",         { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "editar/alternar done" }));
  app.delete("/extras/:extraId",        { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "remover" }));
}
