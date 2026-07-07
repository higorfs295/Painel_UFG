import { buildApp } from "./app.js";
const app = await buildApp();
app.listen({ port: 3333, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
