// RF-05/06/07 — progresso do usuário no curso: status por disciplina (oficial vs simulado),
// somas por composição com teto de exibição em 100% (o excedente fica registrado) e recomendações.
// A lógica de grafo (status/unlock) espelha frontend/src/lib/graph.ts — mantenha as duas em sincronia
// ou extraia para um pacote compartilhado.
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function progressRoutes(app: FastifyInstance) {
  app.get("/enrollments", { preHandler: app.requireAuth }, async (req: any) =>
    app.prisma.enrollment.findMany({ where: { userId: req.user.sub }, include: { course: true } }));
  app.get("/enrollments/:id/progress", { preHandler: app.requireAuth }, async (req, reply) =>
    reply.code(501).send({ todo: "RF-05: somas por composição + status calculado por disciplina + marcos" }));
  app.put("/enrollments/:id/subjects/:subjectId", { preHandler: app.requireAuth }, async (req, reply) => {
    const body = z.object({ state: z.enum(["APPROVED","SIMULATED"]).nullable() }).parse(req.body);
    // TODO RF-06: upsert/delete de SubjectStatus (null = voltar a pendente); validar posse do enrollment
    return reply.code(501).send({ todo: "RF-06" });
  });
  app.get("/enrollments/:id/recommendations", { preHandler: app.requireAuth }, async (req, reply) =>
    reply.code(501).send({ todo: "RF-07: ranking por destravamento transitivo" }));
}
