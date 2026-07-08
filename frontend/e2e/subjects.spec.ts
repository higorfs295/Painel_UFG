// Simulação de disciplina (RF-06): marcar SIMULATED reflete na projeção; limpar volta ao estado.
import { test, expect } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

test("simular disciplina atualiza a projeção e limpar restaura", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Disciplinas" }).click();
  await expect(page.getByRole("heading", { name: "Disciplinas", exact: true })).toBeVisible();

  // busca uma disciplina disponível conhecida da matriz semeada
  await page.getByPlaceholder("Buscar por nome ou código…").fill("Fundamentos de Lógica");
  const row = page.getByRole("row", { name: /Fundamentos de Lógica/ });
  await expect(row).toBeVisible();

  // estado inicial: disponível, sem projeção divergente
  await expect(row.getByText("Disponível")).toBeVisible();

  // simula -> chip muda e o total projetado aparece no cabeçalho
  await row.getByRole("button", { name: "Simular" }).click();
  await expect(row.getByText("Simulada")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Projetado:/)).toBeVisible();

  // limpa -> volta a disponível e a projeção some
  await row.getByRole("button", { name: "Limpar" }).click();
  await expect(row.getByText("Disponível")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Projetado:/)).toHaveCount(0);
});
