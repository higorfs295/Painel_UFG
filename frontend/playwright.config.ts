// E2E com Playwright. Pré-requisitos: Postgres migrado+semeado e API na porta 3333.
// O servidor web (Vite) é iniciado automaticamente; localmente reaproveita um dev server aberto.
// Credenciais da conta semeada via env: E2E_USER_EMAIL / E2E_USER_PASSWORD (a senha do seed).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,        // os testes mutam a mesma conta semeada — rodar em série
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["line"]] : [["line"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
