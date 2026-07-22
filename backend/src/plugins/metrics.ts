// Observabilidade (RNF): métricas HTTP em memória — contadores por classe de status,
// latências (p50/p95/p99 sobre janela deslizante) e agregados por rota. Sem dependências
// externas: para Prometheus/Grafana em produção, o snapshot expõe os mesmos números via
// GET /admin/metrics (JSON), fácil de raspar/adaptar.
import fp from "fastify-plugin";

type RouteAgg = { count: number; totalMs: number; maxMs: number; errors5xx: number };

const startedAt = Date.now();
const status = { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 };
let total = 0;
const byRoute = new Map<string, RouteAgg>();

// janela deslizante de latências (últimas N) para percentis aproximados
const WINDOW = 1000;
const latencies: number[] = [];
let cursor = 0;

function recordLatency(ms: number) {
  if (latencies.length < WINDOW) latencies.push(ms);
  else { latencies[cursor] = ms; cursor = (cursor + 1) % WINDOW; }
}

function percentile(p: number): number | null {
  if (latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, idx)]! * 10) / 10;
}

// fp() quebra o encapsulamento: sem isso o hook só valeria para rotas registradas DENTRO
// do plugin — e as métricas ficariam zeradas para o resto da aplicação.
export const metricsPlugin = fp(async (app) => {
  app.addHook("onResponse", (req, reply, hookDone) => {
    total += 1;
    const code = reply.statusCode;
    if (code >= 500) status.s5xx += 1;
    else if (code >= 400) status.s4xx += 1;
    else if (code >= 300) status.s3xx += 1;
    else status.s2xx += 1;

    const ms = reply.elapsedTime;
    recordLatency(ms);

    // agrega pela rota "padronizada" (/me/enrollments/:id), não pela URL concreta — cardinalidade baixa
    const route = `${req.method} ${req.routeOptions?.url ?? req.url.split("?")[0]}`;
    const agg = byRoute.get(route) ?? { count: 0, totalMs: 0, maxMs: 0, errors5xx: 0 };
    agg.count += 1; agg.totalMs += ms; agg.maxMs = Math.max(agg.maxMs, ms);
    if (code >= 500) agg.errors5xx += 1;
    byRoute.set(route, agg);
    hookDone();
  });
});

export function metricsSnapshot() {
  const mem = process.memoryUsage();
  const routes = [...byRoute.entries()].map(([route, a]) => ({
    route, count: a.count, avgMs: Math.round((a.totalMs / a.count) * 10) / 10,
    maxMs: Math.round(a.maxMs * 10) / 10, errors5xx: a.errors5xx,
  }));
  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    process: {
      node: process.version,
      rssMb: Math.round(mem.rss / 1048576),
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
    },
    http: {
      total,
      status: { ...status },
      latencyMs: { p50: percentile(50), p95: percentile(95), p99: percentile(99) },
      topRoutes: [...routes].sort((a, b) => b.count - a.count).slice(0, 8),
      slowestRoutes: [...routes].sort((a, b) => b.avgMs - a.avgMs).slice(0, 8),
    },
  };
}
