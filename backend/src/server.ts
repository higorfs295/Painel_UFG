import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.PORT ?? 3333);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

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
