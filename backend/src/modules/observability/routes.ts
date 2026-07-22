// Observabilidade (somente ADMIN): métricas do processo/HTTP, saúde detalhada (ping do banco)
// e trilha de auditoria com filtros. Alimenta o painel /admin/monitor do frontend.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { metricsSnapshot } from "../../plugins/metrics.js";

export async function observabilityRoutes(app: FastifyInstance) {
  // Snapshot de métricas em memória + ping do banco (latência medida na hora).
  app.get("/metrics", { preHandler: app.requireAdmin }, async () => {
    const t0 = performance.now();
    let dbOk = true;
    try { await app.prisma.$queryRaw`SELECT 1`; } catch { dbOk = false; }
    const dbPingMs = Math.round((performance.now() - t0) * 10) / 10;
    return { ...metricsSnapshot(), db: { ok: dbOk, pingMs: dbPingMs } };
  });

  // Trilha de auditoria (RF-27) com filtros simples e paginação por cursor de data.
  app.get("/audit", { preHandler: app.requireAdmin }, async (req) => {
    const q = z.object({
      limit: z.coerce.number().int().positive().max(200).default(50),
      action: z.string().optional(),          // prefixo: "auth." pega auth.login/auth.login_failed...
      userId: z.string().optional(),
      before: z.coerce.date().optional(),     // paginação: entradas anteriores a esta data
    }).parse(req.query);

    const entries = await app.prisma.auditLog.findMany({
      where: {
        ...(q.action ? { action: { startsWith: q.action } } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.before ? { createdAt: { lt: q.before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: { user: { select: { name: true, email: true } } },
    });
    return { entries };
  });
}
