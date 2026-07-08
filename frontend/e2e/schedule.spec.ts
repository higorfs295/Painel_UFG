// Grade de horário (RF-10/12 + a11y): cria cenário, navega por teclado, pinta com Enter e limpa.
import { test, expect } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

test("cenário: navegação por teclado pinta e limpa célula; exclusão ao final", async ({ page }) => {
  const name = `E2E ${Date.now()}`;
  await login(page);
  await page.getByRole("link", { name: "Cronograma" }).click();
  await expect(page.getByRole("heading", { name: "Cronograma" })).toBeVisible();

  // cria cenário (o nome vem do prompt nativo)
  page.once("dialog", (d) => d.accept(name));
  await page.getByRole("button", { name: "+ Cenário" }).click();
  const grid = page.getByRole("grid", { name: "Grade semanal de horários" });
  await expect(grid).toBeVisible({ timeout: 10_000 });

  // navegação por teclado: foca 0,0 -> direita -> baixo => 1,1
  const c00 = grid.locator('[data-r="0"][data-c="0"]');
  await c00.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const c11 = grid.locator('[data-r="1"][data-c="1"]');
  await expect(c11).toBeFocused();

  // Enter pinta (persistido no servidor; o aria-label reflete após o refetch)
  await page.keyboard.press("Enter");
  await expect(c11).toHaveAttribute("aria-label", /pintado/, { timeout: 10_000 });

  // Enter de novo na mesma categoria limpa
  await c11.focus();
  await page.keyboard.press("Enter");
  await expect(c11).toHaveAttribute("aria-label", /vazio/, { timeout: 10_000 });

  // limpeza: exclui o cenário criado (confirm nativo)
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("button", { name })).toHaveCount(0);
});
