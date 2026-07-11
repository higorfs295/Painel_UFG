// Extras (RF-08/09): estado "em andamento" e reclassificação de categoria (NL -> NC/NE/optativa).
import { test, expect } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

test("adiciona extra em andamento, reclassifica a categoria e remove", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Extras" }).click();
  await expect(page.getByRole("heading", { name: /Componentes/ })).toBeVisible();

  const nome = `Liga acadêmica ${Date.now()}`;
  const form = page.locator("form");
  await form.getByLabel("Nome").fill(nome);
  await form.getByLabel("CH").fill("50");
  await form.getByLabel("Categoria").selectOption("NL");   // começa como Núcleo Livre
  await form.getByLabel("Situação").selectOption("IN_PROGRESS"); // em andamento
  await form.getByRole("button", { name: "Adicionar" }).click();

  const row = page.getByRole("row", { name: new RegExp(nome) });
  await expect(row).toBeVisible();
  await expect(row.locator("span.chip", { hasText: "Em andamento" })).toBeVisible();

  // reclassifica: NL -> NE (Núcleo Específico). O select da linha persiste via PATCH.
  await row.getByLabel(`Categoria de ${nome}`).selectOption("NE");
  await expect(row.getByLabel(`Categoria de ${nome}`)).toHaveValue("NE");

  // recarrega e confirma que a conversão persistiu no servidor
  await page.reload();
  const row2 = page.getByRole("row", { name: new RegExp(nome) });
  await expect(row2.getByLabel(`Categoria de ${nome}`)).toHaveValue("NE");

  // limpeza
  page.on("dialog", (d) => d.accept());
  await row2.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByRole("row", { name: new RegExp(nome) })).toHaveCount(0);
});
