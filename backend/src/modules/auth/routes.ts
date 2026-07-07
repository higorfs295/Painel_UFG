// RF-02/03/04 — convite, definição de senha, login, refresh, logout, reset.
// Hash de senha com argon2 (argon2.hash / argon2.verify). Tokens de convite: gerar aleatório
// (crypto.randomBytes), armazenar apenas o hash (sha256) e enviar o valor puro no link.
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function authRoutes(app: FastifyInstance) {
  app.post("/invite/accept", async (req, reply) => {
    const body = z.object({ token: z.string(), password: z.string().min(10) }).parse(req.body);
    // TODO RF-02: validar token (hash + expiração + não usado), gravar passwordHash (argon2), marcar usedAt
    return reply.code(501).send({ todo: "RF-02" });
  });
  app.post("/login", async (req, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    // TODO RF-03: argon2.verify; emitir JWT (sub, role) + refresh opaco em cookie httpOnly+secure+sameSite
    return reply.code(501).send({ todo: "RF-03" });
  });
  app.post("/refresh", async (req, reply) => reply.code(501).send({ todo: "RF-03 rotação de refresh" }));
  app.post("/logout",  async (req, reply) => reply.code(501).send({ todo: "revogar refresh" }));
  app.post("/password/forgot", async (req, reply) => reply.code(501).send({ todo: "RF-04" }));
}
