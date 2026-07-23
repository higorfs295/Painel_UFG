// Passeio de fumaça: toda rota do app precisa montar com dados reais, sem erro de
// console e sem estourar a largura. É o teste que pega regressão estrutural (import
// quebrado, hook fora de client component, layout vazando) em uma passada só.
//
// A navegação é pela INTERFACE (clique na barra lateral), não por `page.goto` em cada
// rota. Além de ser o caminho real do usuário, evita um efeito colateral do backend:
// cada carga completa refaz o bootstrap da sessão, e refreshes sobrepostos disparam a
// detecção de reuso do token — que existe justamente para revogar sessões suspeitas.
import { test, expect, type Page } from "@playwright/test";
import { login, loginAdmin, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

/** Coleta erros de console e falhas de página durante a navegação. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const ROTAS_ALUNO = [
  ["Disciplinas", "Disciplinas"],
  ["Extras", "Componentes extras"],
  ["Cronograma", "Cronograma"],
  ["Recomendações", "Recomendações"],
  ["Histórico", "Histórico acadêmico"],
  ["Agenda", "Agenda"],
  ["Ajustes", "Ajustes"],
  ["Ajuda", "Ajuda & sobre"],
  ["Visão geral", "Visão geral"],
] as const;

const ROTAS_ADMIN = [
  ["Usuários", "Usuários"],
  ["Cursos", "Cursos"],
  ["Períodos", "Períodos"],
  ["Avisos", "Avisos"],
  ["Monitor", "Monitor"],
  ["Configurações", "Configurações"],
  ["Visão do sistema", "Visão do sistema"],
] as const;

/** Clica no item da barra lateral e espera o título da página. */
async function irPara(page: Page, link: string, titulo: string) {
  await page.getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: link, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    `overflow horizontal em ${link}`).toBe(false);
}

test("página pública apresenta o produto e leva para a entrada", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("aluno percorre todas as páginas do painel", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page);
  await expect(page.getByRole("heading", { level: 1, name: "Visão geral" })).toBeVisible({ timeout: 15_000 });

  for (const [link, titulo] of ROTAS_ALUNO) await irPara(page, link, titulo);

  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("admin percorre todas as páginas de gestão", async ({ page }) => {
  const errors = watchErrors(page);
  await loginAdmin(page);
  await expect(page.getByRole("heading", { level: 1, name: "Visão do sistema" })).toBeVisible({ timeout: 15_000 });

  for (const [link, titulo] of ROTAS_ADMIN) await irPara(page, link, titulo);

  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("guarda de rota: aluno não entra na administração", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/painel$/, { timeout: 15_000 });
});

test("sem sessão, rota protegida manda para a entrada", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/, { timeout: 15_000 });
});
