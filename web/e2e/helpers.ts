// Utilitários dos testes E2E. As credenciais da conta semeada vêm do ambiente.
import { expect, type Page } from "@playwright/test";

export const EMAIL = process.env.E2E_USER_EMAIL ?? "painel@aluno.com";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "painel@admin.com";
export const PASSWORD = process.env.E2E_USER_PASSWORD ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? PASSWORD;

export function requireCredentials() {
  if (!PASSWORD) {
    throw new Error("Defina E2E_USER_PASSWORD (a senha do seed, SEED_ADMIN_PASSWORD) para rodar os E2E.");
  }
}

/** Entra e espera a casca autenticada aparecer (a sidebar é o sinal de que a sessão valeu). */
export async function login(page: Page, email = EMAIL, password = PASSWORD) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible({ timeout: 15_000 });
}

export const loginAdmin = (page: Page) => login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
