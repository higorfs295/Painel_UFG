import { defineConfig, devices } from "@playwright/test";

// Os testes rodam contra o app Next em :5173 e a API Fastify em :3333 — ambos precisam
// estar de pé (o CI sobe os dois antes). `fullyParallel: false` porque as specs
// compartilham a conta semeada.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // os passeios visitam ~9 páginas cada, todas com round-trip real à API
  timeout: 90_000,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    locale: "pt-BR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
