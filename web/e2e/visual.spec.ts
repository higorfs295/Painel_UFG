// Guardas de acabamento visual — as coisas que quebram em silêncio e ninguém percebe
// até alguém reclamar: contraste do texto secundário e o indicador do item ativo.
import { test, expect, type Page } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

/** Razão de contraste WCAG entre duas cores `rgb(...)` já computadas. */
async function contraste(page: Page, seletor: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const lum = (rgb: string) => {
      const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((n) => {
        const v = Number(n) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    // sobe até achar um ancestral com fundo opaco (o texto herda o fundo do cartão)
    let fundo = "rgb(255, 255, 255)";
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !bg.includes("rgba(0, 0, 0, 0)")) { fundo = bg; break; }
    }
    const [l1, l2] = [lum(getComputedStyle(el).color), lum(fundo)].sort((a, b) => b - a);
    return (l1! + 0.05) / (l2! + 0.05);
  }, seletor);
}

test("o texto secundário passa em AA nos dois temas", async ({ page }) => {
  await login(page);
  await page.getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Histórico acadêmico" })).toBeVisible();

  for (const tema of ["dark", "light"] as const) {
    await page.evaluate((t) => {
      document.documentElement.classList.toggle("dark", t === "dark");
      document.documentElement.style.colorScheme = t;
    }, tema);

    const r = await contraste(page, ".text-subtle-foreground");
    expect(r, `contraste do texto secundário no tema ${tema}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("o item ativo da barra lateral tem indicador visível", async ({ page }) => {
  await login(page);
  const ativo = page.getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Visão geral", exact: true });
  await expect(ativo).toHaveAttribute("aria-current", "page");

  // o pseudo-elemento ::before é o filete; inativo fica com escala 0
  const escala = await ativo.evaluate((el) => getComputedStyle(el, "::before").transform);
  expect(escala, "o indicador do item ativo não está visível").not.toBe("matrix(1, 0, 0, 0, 0, 0)");
});
