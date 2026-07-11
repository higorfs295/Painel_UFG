// Fluxo do ADMIN: login cai direto no painel de gestão (sem telas de aluno) e o
// calendário acadêmico global é gerível em /admin/periodos (RF-20 v2 / RF-21).
import { test, expect } from "@playwright/test";
import { PASSWORD, requireCredentials } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "fhigor295@gmail.com";

test.beforeAll(() => requireCredentials());

test("admin entra na visão do sistema e agenda uma virada de período", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  // admin não cursa: nada de "Visão geral" — direto no painel do sistema
  await expect(page.getByRole("heading", { name: "Visão do sistema" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Usuários", exact: true })).toBeVisible();

  // calendário: agenda um TERM futuro e depois remove (deixa o estado como estava)
  await page.getByRole("link", { name: "Períodos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Períodos" })).toBeVisible();

  await page.getByLabel("Tipo").selectOption("TERM");
  await page.getByLabel("Rótulo").fill("2031.2");
  await page.getByLabel("Começa em").fill("2031-08-11");
  await page.getByRole("button", { name: "Agendar", exact: true }).click();

  const novaLinha = page.locator(".tl-item", { hasText: "2031.2" });
  await expect(novaLinha).toBeVisible();
  await expect(novaLinha.getByText("agendado")).toBeVisible();

  page.on("dialog", (d) => d.accept());
  await novaLinha.getByRole("button", { name: /Remover virada/ }).click();
  await expect(novaLinha).toHaveCount(0);
});
