// Config única. Os scripts escolhem o alvo:
//   npm test              -> test/unit  (domínio puro + crypto, sem banco)
//   npm run test:integration -> test/integration (rotas via app.inject contra Postgres real)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"], // carrega .env (inócuo para os unitários)
    hookTimeout: 30_000,
  },
});
