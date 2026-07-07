// RF-01 — administração de usuários (somente ADMIN). O admin cria o usuário SEM senha;
// o sistema gera um convite e o próprio usuário define a senha (RF-02).
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.requireAdmin }, async () => {
    return { todo: "listar usuários (id, nome, email, role, cursos)" };
  });
  app.post("/", { preHandler: app.requireAdmin }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(2), email: z.string().email(),
      role: z.enum(["ADMIN","USER"]).default("USER"),
      courseSlug: z.string().optional(),           // matrícula inicial opcional
    }).parse(req.body);
    // TODO RF-01: criar User(passwordHash=null) + Enrollment opcional + InviteToken; retornar link do convite
    return reply.code(501).send({ todo: "RF-01" });
  });
  app.post("/:id/invite", { preHandler: app.requireAdmin }, async (req, reply) =>
    reply.code(501).send({ todo: "reemitir convite/reset" }));
  app.delete("/:id", { preHandler: app.requireAdmin }, async (req, reply) =>
    reply.code(501).send({ todo: "remover usuário (cascade)" }));
}
