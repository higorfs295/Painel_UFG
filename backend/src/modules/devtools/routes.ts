// Ferramentas de desenvolvimento — geram massa de dados realista para exercitar o painel
// (demos, testes manuais, screenshots). SEGURANÇA: exigem ADMIN **e** DEV_TOOLS=true **e**
// NODE_ENV != production (devToolsEnabled já combina flag + ambiente). Em produção respondem 403.
// A geração em si vive em ./service.ts — aqui só validação, autorização e auditoria.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { devToolsEnabled } from "../../env.js";
import { audit } from "../../lib/audit.js";
import { seedFakeStudents, purgeFakeStudents, SAMPLE_ANNOUNCEMENTS } from "./service.js";

const seedBody = z.object({
  count: z.number().int().min(1).max(50).default(10),
  courseSlug: z.string().min(1),
  password: z.string().min(10).default("senha-de-teste-123"),
  progress: z.number().min(0).max(1).default(0.4), // fração da matriz já aprovada
});

export async function devToolsRoutes(app: FastifyInstance) {
  // Guarda dupla: papel + ambiente. Aplica-se a TODAS as rotas deste módulo.
  app.addHook("onRequest", async (_req, reply) => {
    if (!devToolsEnabled)
      return reply.code(403).send({ error: "ferramentas de desenvolvimento desativadas (DEV_TOOLS)" });
  });

  app.post("/students", { preHandler: app.requireAdmin }, async (req, reply) => {
    const body = seedBody.parse(req.body);
    const emails = await seedFakeStudents(app.prisma, body);
    await audit(app.prisma, {
      userId: req.user.sub, action: "dev.seed_students",
      meta: { count: emails.length, courseSlug: body.courseSlug }, ip: req.ip,
    });
    return reply.code(201).send({ created: emails.length, emails, password: body.password });
  });

  app.delete("/students", { preHandler: app.requireAdmin }, async (req) => {
    const removed = await purgeFakeStudents(app.prisma);
    await audit(app.prisma, {
      userId: req.user.sub, action: "dev.purge_students", meta: { removed }, ip: req.ip,
    });
    return { removed };
  });

  // Avisos de exemplo — deixa o feed vivo para demos.
  app.post("/announcements", { preHandler: app.requireAdmin }, async (req, reply) => {
    await app.prisma.announcement.createMany({
      data: SAMPLE_ANNOUNCEMENTS.map((s) => ({ ...s, authorId: req.user.sub })),
    });
    return reply.code(201).send({ created: SAMPLE_ANNOUNCEMENTS.length });
  });
}
