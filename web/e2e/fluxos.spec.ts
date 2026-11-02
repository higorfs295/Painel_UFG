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

  // as marcações ficam no menu de ações da linha (padrão do DataTable da Tremor)
  await linha.getByRole("button", { name: /^Ações de / }).click();
  await page.getByRole("menuitem", { name: /^Simular/ }).click();
  await expect(linha.getByText("Simulada")).toBeVisible({ timeout: 15_000 });

  await linha.getByRole("button", { name: /^Ações de / }).click();
  await page.getByRole("menuitem", { name: "Limpar marcação" }).click();
  await expect(linha.getByText("Disponível")).toBeVisible({ timeout: 15_000 });
});

test("seleção em lote: simula duas disciplinas de uma vez e desfaz", async ({ page }) => {
  await login(page);
  await nav(page).getByRole("link", { name: "Disciplinas", exact: true }).click();
  await page.getByRole("tab", { name: "Disponíveis" }).click();

  const linhas = page.locator("tbody tr");
  const primeira = linhas.nth(0), segunda = linhas.nth(1);
  await primeira.getByRole("checkbox").click();
  await segunda.getByRole("checkbox").click();
  await expect(page.getByText("2 selecionada(s)").first()).toBeVisible();

  // barra de comandos em lote (CommandBar)
  await page.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(primeira.getByText("Simulada")).toBeVisible({ timeout: 15_000 });
  await expect(segunda.getByText("Simulada")).toBeVisible({ timeout: 15_000 });

  await primeira.getByRole("checkbox").click();
  await segunda.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await expect(primeira.getByText("Disponível")).toBeVisible({ timeout: 15_000 });
  await expect(segunda.getByText("Disponível")).toBeVisible({ timeout: 15_000 });
});

test("anotação de disciplina: salva pela gaveta e remove", async ({ page }) => {
  const texto = `E2E nota ${Date.now()}`;
  await login(page);
  await nav(page).getByRole("link", { name: "Disciplinas", exact: true }).click();
  await page.locator("tbody tr").first().locator("td").nth(3).getByRole("button").click();

  const gaveta = page.getByRole("dialog");
  await expect(gaveta).toBeVisible();
  await gaveta.getByLabel("Anotação").fill(texto);
  await gaveta.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(page.getByText("Anotação salva.")).toBeVisible({ timeout: 15_000 });

  await gaveta.getByLabel("Anotação").fill("");
  await gaveta.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(page.getByText("Anotação removida.")).toBeVisible({ timeout: 15_000 });
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
  await page.getByLabel("Rótulo").fill("2099.1");
  await page.getByLabel("Começa em").fill("2099-03-01");
  await page.getByRole("button", { name: "Agendar" }).click();

  const item = page.locator("li", { hasText: "2099.1" }).first();
  await expect(item).toBeVisible({ timeout: 15_000 });

  await item.getByRole("button", { name: /^Remover virada/ }).click();
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

// ── v12 ──────────────────────────────────────────────────────────────────────────────

test("admin também acompanha o próprio curso (modo aluno) e volta para a gestão", async ({ page }) => {
  await loginAdmin(page);
  await nav(page).getByRole("link", { name: "Meu painel", exact: true }).click();
  // primeira vez: a casca oferece a escolha do curso; nas próximas, o painel abre direto
  const escolher = page.getByRole("heading", { level: 1, name: "Acompanhar o seu curso" });
  const painel = page.getByRole("heading", { level: 1, name: "Visão geral" });
  await expect(escolher.or(painel)).toBeVisible({ timeout: 15_000 });
  if (await escolher.isVisible()) {
    const curso = page.getByLabel("Curso", { exact: true });
    await curso.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Começar" }).click();
  }
  await expect(painel).toBeVisible({ timeout: 15_000 });
  // na área do aluno, a navegação do admin troca e oferece o caminho de volta
  await expect(nav(page).getByRole("link", { name: "Disciplinas", exact: true })).toBeVisible();
  await nav(page).getByRole("link", { name: "Administração", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Visão do sistema" })).toBeVisible({ timeout: 15_000 });
});

test("cor de destaque e barra lateral mudam na hora e ficam salvas na conta", async ({ page }) => {
  await login(page);
  await page.goto("/config#aparencia");
  const html = page.locator("html");
  const original = (await html.getAttribute("data-accent")) ?? "orange";
  const originalBar = (await html.getAttribute("data-sidebar")) ?? "light";
  const nomes: Record<string, string> = { orange: "Laranja", blue: "Azul", violet: "Violeta", emerald: "Verde", rose: "Rosa" };
  const barras: Record<string, string> = { light: "Clara", dark: "Escura", color: "Colorida" };
  const alvo = original === "violet" ? "emerald" : "violet";

  await page.getByRole("radio", { name: nomes[alvo], exact: true }).click();
  await page.getByRole("radiogroup", { name: "Barra lateral" }).getByRole("radio", { name: /^Colorida/ }).click();
  await expect(html).toHaveAttribute("data-accent", alvo);
  await expect(html).toHaveAttribute("data-sidebar", "color");
  await expect(page.getByText("Aparência salva na sua conta.").first()).toBeVisible({ timeout: 15_000 });

  // num navegador "novo" (sem o localStorage), a escolha volta da conta
  await page.evaluate(() => localStorage.removeItem("painel-aparencia"));
  await page.reload();
  await expect(html).toHaveAttribute("data-accent", alvo, { timeout: 15_000 });

  // devolve como estava (as outras specs não dependem disso, mas a conta é compartilhada)
  await page.getByRole("radio", { name: nomes[original] ?? "Laranja", exact: true }).click();
  await page.getByRole("radiogroup", { name: "Barra lateral" }).getByRole("radio", { name: new RegExp(`^${barras[originalBar] ?? "Clara"}`) }).click();
  await expect(html).toHaveAttribute("data-accent", original);
});

test("admin convida uma pessoa, encontra na lista e remove a conta", async ({ page }) => {
  await loginAdmin(page);
  await nav(page).getByRole("link", { name: "Usuários", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();

  const email = `e2e.${Date.now()}@exemplo.local`;
  await page.getByRole("button", { name: "Convidar" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nome").fill("Pessoa de Teste E2E");
  await dialogo.getByLabel("E-mail").fill(email);
  await dialogo.getByRole("button", { name: "Criar e convidar" }).click();
  await expect(dialogo.getByText("/convite/")).toBeVisible({ timeout: 15_000 });
  await dialogo.getByRole("button", { name: "Concluir" }).click();

  await page.getByRole("searchbox", { name: "Buscar usuário" }).fill(email);
  const linha = page.locator("tbody tr", { hasText: email });
  await expect(linha).toBeVisible({ timeout: 15_000 });
  await expect(linha.getByText("Convite pendente")).toBeVisible();

  await linha.getByRole("button", { name: /^Ações de / }).click();
  await page.getByRole("menuitem", { name: /^Remover conta/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(page.locator("tbody tr", { hasText: email })).toHaveCount(0, { timeout: 15_000 });
});

test("relatório do curso mostra só agregados (ou se esconde em turma pequena)", async ({ page }) => {
  await loginAdmin(page);
  await nav(page).getByRole("link", { name: "Relatórios", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Retrato do curso" })).toBeVisible();
  const oculto = page.getByRole("heading", { name: "Relatório oculto para proteger os alunos" });
  const distribuicao = page.getByRole("heading", { name: "Distribuição da integralização" });
  await expect(oculto.or(distribuicao)).toBeVisible({ timeout: 15_000 });
});
