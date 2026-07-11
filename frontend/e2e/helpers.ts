// Utilitários dos testes E2E. Credenciais da conta semeada vêm do ambiente.
import { expect, type Page } from "@playwright/test";

// Conta-aluno semeada (o admin não tem matrícula e cai em /admin — os fluxos de aluno
// precisam da conta de demonstração criada pelo seed).
export const EMAIL = process.env.E2E_USER_EMAIL ?? "aluno@painel.local";
export const PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

export function requireCredentials() {
  if (!PASSWORD) {
    throw new Error(
      "Defina E2E_USER_PASSWORD (a senha do seed, SEED_ADMIN_PASSWORD) para rodar os E2E.",
    );
  }
}

// Faz login pela UI e espera a Visão geral carregar.
export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible({ timeout: 15_000 });
}
