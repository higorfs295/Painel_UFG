import { buildApp } from "./app.js";
import { pruneRefreshTokens } from "./lib/session.js";

const app = await buildApp();
const port = Number(process.env.PORT ?? 3333);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Expurgo periódico de tokens vencidos/revogados (a tabela cresce a cada login/rotação).
// Simples por processo; com várias réplicas, mover para um worker/cron único.
const runPrune = () =>
  pruneRefreshTokens(app.prisma)
    .then((n) => n && app.log.info(`expurgo: ${n} refresh tokens removidos`))
    .catch((err) => app.log.warn({ err }, "falha no expurgo de tokens"));
runPrune();
const pruneTimer = setInterval(runPrune, 24 * 60 * 60 * 1000);
pruneTimer.unref(); // não segura o event loop no shutdown

// Encerramento gracioso: fecha o servidor (drena requests em voo) e desconecta o Prisma
// via hook onClose. Importante sob orquestradores (docker stop / k8s enviam SIGTERM).
let closing = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    if (closing) return;
    closing = true;
    app.log.info(`recebido ${sig}, encerrando graciosamente…`);
    try { await app.close(); process.exit(0); }
    catch (err) { app.log.error(err); process.exit(1); }
  });
}
