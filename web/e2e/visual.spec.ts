// Guardas de acabamento visual — as coisas que quebram em silêncio e ninguém percebe
// até alguém reclamar: contraste do texto secundário e o destaque do item ativo.
import { test, expect, type Page } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeAll(() => requireCredentials());

/** Razão de contraste WCAG entre a cor do texto e a do fundo opaco mais próximo. */
async function contraste(page: Page, seletor: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    // A paleta do Tailwind v4 é oklch(): em vez de interpretar a string, o próprio
    // navegador converte a cor para sRGB pintando 1 px num canvas.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const lum = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((n) => {
        const v = n / 255;
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

  // texto secundário do desenho Tremor: gray-500 no claro, gray-400 no escuro
  for (const tema of ["dark", "light"] as const) {
    await page.evaluate((t) => {
      document.documentElement.classList.toggle("dark", t === "dark");
      document.documentElement.style.colorScheme = t;
    }, tema);
    // a troca manual de classe não passa pelo next-themes (que desliga as transições):
    // espera as cores de fundo terminarem de transicionar antes de medir
    await page.waitForTimeout(400);

    const r = await contraste(page, "main p.text-gray-500");
    expect(r, `contraste do texto secundário no tema ${tema}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("o item ativo da barra lateral se distingue dos demais", async ({ page }) => {
  await login(page);
  const navegacao = page.getByRole("navigation", { name: "Navegação principal" });
  const ativo = navegacao.getByRole("link", { name: "Visão geral", exact: true });
  const inativo = navegacao.getByRole("link", { name: "Disciplinas", exact: true });
  await expect(ativo).toHaveAttribute("aria-current", "page");
  await expect(inativo).not.toHaveAttribute("aria-current", "page");

  // no template da Tremor o indicador é a cor de acento no texto do item ativo
  const cor = (el: HTMLElement | SVGElement) => getComputedStyle(el).color;
  expect(await ativo.evaluate(cor), "o item ativo precisa ter cor própria").not.toBe(await inativo.evaluate(cor));
});

test("o botão principal passa em AA nas cinco cores de destaque, nos dois temas", async ({ page }) => {
  await login(page);
  await page.goto("/config#aparencia");
  const botao = page.getByRole("button", { name: "Botão principal" });
  await expect(botao).toBeVisible({ timeout: 15_000 });
  for (const tema of ["light", "dark"] as const) {
    for (const cor of ["orange", "blue", "violet", "emerald", "rose"]) {
      await page.evaluate(([t, c]) => {
        const d = document.documentElement;
        d.classList.toggle("dark", t === "dark");
        d.dataset.accent = c!;
      }, [tema, cor]);
      await page.waitForTimeout(250); // o botão tem transição de cor: mede depois que ela termina
      const r = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Botão principal")!;
        const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const lum = (css: string) => {
          ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((n) => {
            const v = n / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const cs = getComputedStyle(btn);
        const [a, b] = [lum(cs.color), lum(cs.backgroundColor)].sort((x, y) => y - x);
        return (a! + 0.05) / (b! + 0.05);
      });
      expect(r, `contraste do botão principal (${cor}, ${tema})`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
