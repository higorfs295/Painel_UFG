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

  // Trilha de auditoria (RF-27) com filtros e paginação por cursor de data.
  // v12: busca livre (ação, alvo, nome/e-mail de quem fez), intervalo de datas e `nextBefore`
  // pronto para a próxima página.
  app.get("/audit", { preHandler: app.requireAdmin }, async (req) => {
    const q = z.object({
      limit: z.coerce.number().int().positive().max(200).default(50),
      action: z.string().optional(),          // prefixo: "auth." pega auth.login/auth.login_failed...
      userId: z.string().optional(),
      q: z.string().trim().min(1).max(100).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      before: z.coerce.date().optional(),     // paginação: entradas anteriores a esta data
    }).parse(req.query);

    const createdAt = {
      ...(q.from ? { gte: q.from } : {}),
      ...(q.to || q.before
        ? { lt: q.before && q.to ? (q.before < q.to ? q.before : q.to) : (q.before ?? q.to)! }
        : {}),
    };
    const entries = await app.prisma.auditLog.findMany({
      where: {
        ...(q.action ? { action: { startsWith: q.action } } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...(q.q ? {
          OR: [
            { action: { contains: q.q, mode: "insensitive" as const } },
            { entity: { contains: q.q, mode: "insensitive" as const } },
            { entityId: { contains: q.q } },
            { user: { name: { contains: q.q, mode: "insensitive" as const } } },
            { user: { email: { contains: q.q, mode: "insensitive" as const } } },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: { user: { select: { name: true, email: true } } },
    });
    const last = entries.at(-1);
    return { entries, nextBefore: entries.length === q.limit && last ? last.createdAt : null };
  });

  // v12 — ações distintas já registradas (alimenta o filtro da tela de auditoria).
  app.get("/audit/actions", { preHandler: app.requireAdmin }, async () => {
    const rows = await app.prisma.auditLog.groupBy({
      by: ["action"], _count: { _all: true }, orderBy: { action: "asc" },
    });
    return { actions: rows.map((r) => ({ action: r.action, count: r._count._all })) };
  });
}
