// Fluxo de autenticação: erro uniforme e login com a conta semeada.
import { test, expect } from "@playwright/test";
import { EMAIL, login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

test("login com senha errada mostra erro e não navega", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill("senha-completamente-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login válido carrega a Visão geral com dados reais", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/integralizadas/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Composições curriculares" })).toBeVisible();
  // recomendações vêm do grafo no servidor
  await expect(page.getByRole("heading", { name: /Recomendações/ })).toBeVisible();
});
