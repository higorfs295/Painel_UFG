// Fluxos que escrevem no servidor. Cada teste se auto-limpa para poder rodar de novo
// contra a mesma conta semeada.
import { test, expect, type Page } from "@playwright/test";
import { login, loginAdmin, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegação principal" });

test("simular disciplina marca a linha e limpar desmarca", async ({ page }) => {
  await login(page);
  await nav(page).getByRole("link", { name: "Disciplinas", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Disciplinas" })).toBeVisible();

  // filtra por disponíveis para pegar uma linha que aceita marcação
  await page.getByRole("tab", { name: "Disponíveis" }).click();
  const linha = page.locator("tbody tr").first();

  await linha.getByRole("button", { name: "Simular" }).click();
  await expect(linha.getByText("Simulada")).toBeVisible({ timeout: 15_000 });

  await linha.getByRole("button", { name: "Limpar" }).click();
  await expect(linha.getByText("Disponível")).toBeVisible({ timeout: 15_000 });
});

test("extra em andamento: cria, reclassifica a categoria e remove", async ({ page }) => {
  const nome = `E2E extra ${Date.now()}`;
  await login(page);
  await nav(page).getByRole("link", { name: "Extras", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Componentes extras" })).toBeVisible();

  const form = page.locator("form").first();
  await form.getByLabel("Nome").fill(nome);
  await form.getByLabel("CH").fill("32");
  await form.getByLabel("Situação").selectOption("IN_PROGRESS");
  await form.getByRole("button", { name: "Adicionar" }).click();

  const linha = page.locator("tbody tr", { hasText: nome });
  await expect(linha).toBeVisible({ timeout: 15_000 });
  // pelo valor do seletor, não pelo texto: "Em andamento" também é uma <option> da linha
  await expect(linha.getByLabel(`Situação de ${nome}`)).toHaveValue("IN_PROGRESS");

  // reclassificar reroteia a soma: NL -> NC
  const patch = page.waitForResponse((r) => r.url().includes("/me/extras/") && r.request().method() === "PATCH" && r.ok());
  await linha.getByLabel(`Categoria de ${nome}`).selectOption("NC");
  await patch;

  await linha.getByRole("button", { name: "Remover" }).click();
  await expect(page.locator("tbody tr", { hasText: nome })).toHaveCount(0, { timeout: 15_000 });
});

test("cronograma: cria cenário, navega por teclado, pinta e exclui", async ({ page }) => {
  const nome = `E2E ${Date.now()}`;
  await login(page);
  await nav(page).getByRole("link", { name: "Cronograma", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cronograma" })).toBeVisible();

  await page.getByLabel("Novo cenário").fill(nome);
  await page.getByRole("button", { name: "+ Cenário" }).click();

  const grade = page.getByRole("grid", { name: "Grade semanal de horários" });
  await expect(grade).toBeVisible({ timeout: 15_000 });

  // navegação por teclado: 0,0 -> direita -> baixo => 1,1
  await grade.locator('[data-r="0"][data-c="0"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const alvo = grade.locator('[data-r="1"][data-c="1"]');
  await expect(alvo).toBeFocused();

  // Enter pinta (o aria-label reflete depois do round-trip com o servidor)
  await page.keyboard.press("Enter");
  await expect(alvo).toHaveAttribute("aria-label", /pintado/, { timeout: 15_000 });
  await alvo.focus();
  await page.keyboard.press("Enter");
  await expect(alvo).toHaveAttribute("aria-label", /vazio/, { timeout: 15_000 });

  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("button", { name: nome })).toHaveCount(0, { timeout: 15_000 });
});

test("admin agenda uma virada de período e remove", async ({ page }) => {
  await loginAdmin(page);
  await nav(page).getByRole("link", { name: "Períodos", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Períodos" })).toBeVisible();

  // uma data bem no futuro não interfere no período vigente das outras specs
  await page.getByLabel("Rótulo (AAAA.S)").fill("2099.1");
  await page.getByLabel("Começa em").fill("2099-03-01");
  await page.getByRole("button", { name: "Agendar" }).click();

  const item = page.locator("li", { hasText: "2099.1" }).first();
  await expect(item).toBeVisible({ timeout: 15_000 });

  await item.getByRole("button", { name: "Remover entrada" }).click();
  await expect(page.locator("li", { hasText: "2099.1" })).toHaveCount(0, { timeout: 15_000 });
});

test("paleta de comandos (Ctrl+K) navega entre páginas", async ({ page }) => {
  await login(page);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();

  await page.getByRole("combobox", { name: "Buscar comandos" }).fill("hist");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Histórico acadêmico" })).toBeVisible({ timeout: 15_000 });
});

test("lixeira de cursos exige a confirmação do slug (RF-28)", async ({ page }) => {
  await loginAdmin(page);
  await nav(page).getByRole("link", { name: "Cursos", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cursos" })).toBeVisible();

  await page.getByRole("button", { name: "Excluir" }).first().click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();

  // etapa 1 mostra o impacto; etapa 2 exige digitar o slug
  await dialogo.getByRole("button", { name: "Entendi, continuar" }).click();
  const confirmar = dialogo.getByRole("button", { name: "Mover para a lixeira" });
  await expect(confirmar).toBeDisabled();

  await dialogo.getByRole("textbox").fill("slug-errado");
  await expect(confirmar).toBeDisabled();

  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toHaveCount(0);
});
