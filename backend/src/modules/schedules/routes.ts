// RF-10/11/12 — cenários de cronograma, disciplinas com código SIGAA e pintura de atividades.
// O parser/validação de código SIGAA deve rodar também no servidor (não confiar no cliente):
// porte frontend/src/lib/sigaa.ts para cá (ou pacote compartilhado).
import type { FastifyInstance } from "fastify";

export async function scheduleRoutes(app: FastifyInstance) {
  app.get   ("/enrollments/:id/scenarios",            { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "listar cenários com disciplinas e pinturas" }));
  app.post  ("/enrollments/:id/scenarios",            { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "criar/duplicar" }));
  app.patch ("/scenarios/:sid",                       { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "renomear" }));
  app.delete("/scenarios/:sid",                       { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "excluir" }));
  app.post  ("/scenarios/:sid/disciplines",           { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "adicionar disciplina (validar código SIGAA)" }));
  app.patch ("/scenarios/:sid/disciplines/:did",      { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "editar código/dados" }));
  app.delete("/scenarios/:sid/disciplines/:did",      { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "remover" }));
  app.put   ("/scenarios/:sid/paint",                 { preHandler: app.requireAuth }, async (req, reply) => reply.code(501).send({ todo: "upsert/limpar célula pintada" }));
}
