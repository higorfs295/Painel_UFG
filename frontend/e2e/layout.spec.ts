// Guardas do layout v8 (Tailwind). Duas regressões que só aparecem no navegador de verdade:
// a gaveta lateral no mobile e a troca de tema alcançando o fundo da página.
import { test, expect } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

test("mobile: a lateral fica fora da tela, o hambúrguer abre a gaveta e nada estoura na horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);

  const aside = page.locator("aside");
  expect((await aside.boundingBox())!.x).toBeLessThan(-100);

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect.poll(async () => (await aside.boundingBox())!.x).toBe(0);

  // páginas com tabela são as candidatas naturais a vazar largura
  await page.getByRole("link", { name: "Histórico" }).click();
  // level 1: "Histórico escolar" é um h3 da mesma página e casaria também
  await expect(page.getByRole("heading", { level: 1, name: /Histórico/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("a troca de tema alcança o fundo da página, não só os cartões", async ({ page }) => {
  await login(page);
  const bg = () => page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    text: getComputedStyle(document.body).color,
  }));

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  expect(await bg()).toEqual({ html: "rgb(250, 246, 238)", text: "rgb(36, 27, 19)" });

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  expect(await bg()).toEqual({ html: "rgb(20, 16, 10)", text: "rgb(245, 234, 219)" });
});
