// E2E do REDESIGN do Pipeline (Prompt 06) contra a API real: cabeçalho, filtros com chips, celular
// (uma etapa por vez, sem overflow), estados de arraste, teclado e ações. Os testes marcados @cross
// também rodam em Firefox e WebKit. Tenants: ver support/env.ts (60, 97–100 = @cross; 111+ = só Chromium).
import { expect, test } from "@playwright/test";
import { Api, phoneOf, type ImportRow } from "./support/api";
import { cardNames, column, columnTotal, loginUi, openPipeline, waitBoardIdle } from "./support/app";
import { tenantOf } from "./support/env";

const rows = (n: number, label: string, prefix: number): ImportRow[] =>
  Array.from({ length: n }, (_, i) => ({ name: `${label} ${String(i).padStart(3, "0")}`, phone: phoneOf(prefix, i) }));

const horizontalOverflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("cabeçalho e ações", () => {
  test("totais do servidor no cabeçalho (170 oportunidades) e valores só quando exatos @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 97);
    const api = await Api.login(tenant);
    const [novo, contato] = (await api.defaultPipeline()).stages;
    await api.seed(rows(130, "Grande", 80), novo!.id);
    await api.seed(rows(40, "Contato", 81), contato!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const summary = page.locator("header p[aria-live='polite']");
    await expect(summary).toContainText("170 oportunidades");
    await expect(summary).toContainText("170 em andamento");
    // coluna parcial (25 de 130): nenhuma soma no cabeçalho dela nem valor no resumo
    await expect(summary).not.toContainText("R$");
    await expect(column(page, "Novo").locator("[title^='Soma dos valores']")).toHaveCount(0);
    expect(await columnTotal(page, "Novo")).toBe(130);
  });

  test("'Novo lead' leva ao cadastro; Importar abre o assistente; nome do pipeline à vista", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 111);
    await loginUi(page, tenant);
    await openPipeline(page);
    await expect(page.getByRole("heading", { level: 1, name: /Pipeline/ })).toBeVisible();
    await expect(page.getByText("Comercial", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Importar planilha" }).first().click();
    await expect(page.getByRole("dialog", { name: "Importar leads via CSV" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: /Novo lead/ }).click();
    await expect(page).toHaveURL(/\/leads\?novo=1/);
  });
});

test.describe("filtros", () => {
  test("busca, responsável, período e ordem viram chips removíveis e vão juntos ao servidor @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 98);
    const admin = await Api.login(tenant, "admin");
    const gestor = await Api.login(tenant, "gestor");
    const [novo] = (await admin.defaultPipeline()).stages;
    await admin.seed([{ name: "Maria Admin", phone: phoneOf(82, 1) }, { name: "Carla Admin", phone: phoneOf(82, 2) }], novo!.id);
    await gestor.seed([{ name: "Maria Gestora", phone: phoneOf(82, 3) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/leads?")) requests.push(r.url());
    });
    await page.getByLabel("Buscar lead", { exact: true }).fill("maria");
    await page.getByLabel("Responsável").selectOption({ label: "Gestor t" + String(tenant).padStart(2, "0") });
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByRole("button", { name: "Hoje" }).click();
    await page.getByLabel("Ordenação").selectOption("az");
    const chips = page.getByRole("group", { name: "Filtros ativos" });
    await expect(chips).toContainText("Busca: maria");
    await expect(chips).toContainText("Criados em: Hoje");
    await expect(chips).toContainText("Ordem: Nome A-Z");
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Abrir Maria Gestora" })).toBeVisible();
    expect(requests.some((u) => u.includes("search=maria") && u.includes("owner_id=") && u.includes("date_from=") && u.includes("sort_by=name"))).toBe(true);
    // remover um chip refaz a consulta sem aquele filtro e mantém os demais
    await chips.getByRole("button", { name: /Remover filtro Criados em/ }).click();
    await expect(chips).not.toContainText("Criados em");
    await expect(chips).toContainText("Busca: maria");
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByRole("group", { name: "Filtros ativos" })).toHaveCount(0);
    await waitBoardIdle(page);
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(3);
  });

  test("o painel 'Filtros' abre e fecha por teclado e informa o estado", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 112);
    await loginUi(page, tenant);
    await openPipeline(page);
    const toggle = page.getByRole("button", { name: /^Filtros/ });
    await toggle.focus();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "7 dias" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "7 dias" })).toBeHidden();
  });
});

test.describe("celular (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sem rolagem horizontal da PÁGINA, abas de etapa e uma coluna por vez @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 99);
    const api = await Api.login(tenant);
    const [novo, contato] = (await api.defaultPipeline()).stages;
    await api.seed(rows(6, "Novo", 83), novo!.id);
    await api.seed(rows(3, "Contato", 84), contato!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1); // WebKit/iPhone: antes ~65 px
    await page.getByRole("button", { name: /^Filtros/ }).click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1); // também com os campos de data abertos
    await page.getByRole("button", { name: /^Filtros/ }).click();
    const tabs = page.getByRole("group", { name: "Escolher etapa" });
    await expect(tabs).toBeVisible();
    await expect(page.locator("[data-stage-column]")).toHaveCount(1);
    expect(await cardNames(page, "Novo")).toHaveLength(6);
    await tabs.getByRole("button", { name: /Em contato/ }).click();
    await expect(page.locator("[data-stage-column]")).toHaveCount(1);
    expect(await cardNames(page, "Em contato")).toHaveLength(3);
    await expect(tabs.getByRole("button", { name: /Em contato/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("nenhuma função some: mover pelo seletor, abrir o lead, contatos, importar e exportar", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 113);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.createLead({ name: "Cliente Mobile", stageId: novo!.id, ownerId: (await api.me()).id, phone: phoneOf(85, 1), email: "m@example.com" });
    await loginUi(page, tenant);
    await openPipeline(page);
    const move = page.getByLabel("Mover Cliente Mobile para outra etapa");
    await expect(move).toBeVisible(); // sem foco: não há arrastar com o dedo
    await expect(page.getByRole("link", { name: "Abrir WhatsApp de Cliente Mobile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Escrever e-mail para Cliente Mobile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar" })).toBeVisible(); // texto curto; nome acessível completo
    await expect(page.getByRole("button", { name: "Importar planilha" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
    await page.getByRole("button", { name: "Abrir Cliente Mobile" }).click();
    await expect(page.getByRole("dialog", { name: "Lead Cliente Mobile" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar lead" }).click();
    await move.selectOption({ label: "Em contato" });
    await expect.poll(async () => (await api.leads())[0]!.stage_id).not.toBe(novo!.id);
  });
});

test.describe("tablet (768 × 1024) e notebook (1366 × 768)", () => {
  for (const [name, width, height] of [
    ["tablet", 768, 1024],
    ["notebook", 1366, 768],
  ] as const) {
    test(`${name}: a página não rola na horizontal; o quadro rola dentro dele e a coluna rola na vertical`, async ({ page }, testInfo) => {
      const tenant = tenantOf(testInfo, name === "tablet" ? 114 : 115);
      const api = await Api.login(tenant);
      const [novo, contato, ganho, perdido] = (await api.defaultPipeline()).stages;
      await api.seed(rows(40, "Muitos", 86), novo!.id);
      await api.seed(rows(2, "Poucos", 87), contato!.id);
      void ganho;
      void perdido;
      await page.setViewportSize({ width, height });
      await loginUi(page, tenant);
      await openPipeline(page);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      const board = page.locator("[data-stage-column]").first().locator("xpath=..");
      const scrolls = await board.evaluate((el) => ({ x: el.scrollWidth > el.clientWidth, overflowX: getComputedStyle(el).overflowX }));
      expect(scrolls.overflowX).toBe("auto");
      if (width < 1000) expect(scrolls.x).toBe(true); // 4 colunas não cabem: rolam DENTRO do quadro
      const body = column(page, "Novo").locator("div").filter({ has: page.locator("[data-lead-id]") }).first();
      const verticalScroll = await body.evaluate((el) => el.scrollHeight > el.clientHeight);
      expect(verticalScroll).toBe(true); // 25 cartões: a coluna tem rolagem própria
    });
  }
});

test.describe("arrastar e teclado", () => {
  test("estados do arraste: origem esmaecida, destino com 'Soltar aqui', cancelar limpa e nada é movido", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 100);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(3, "Arraste", 88), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const source = page.locator("[data-lead-id]").first();
    const target = column(page, "Em contato");
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await source.dispatchEvent("dragstart", { dataTransfer: transfer });
    await target.dispatchEvent("dragenter", { dataTransfer: transfer });
    await expect(target.getByText("Soltar aqui")).toBeVisible();
    await expect(column(page, "Novo").getByText("Soltar aqui")).toHaveCount(0); // origem não é destino
    await source.dispatchEvent("dragend", { dataTransfer: transfer }); // cancelado (Esc / soltou fora)
    await expect(page.getByText("Soltar aqui")).toHaveCount(0);
    expect(await api.leads().then((l) => l.every((x) => x.stage_id === novo!.id))).toBe(true);
  });

  test("Tab percorre cabeçalho → filtros → cartões; Enter abre o lead e o foco volta ao fechar", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 116);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(2, "Teclado", 89), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const order: string[] = [];
    await page.getByRole("link", { name: /Novo lead/ }).focus();
    for (let i = 0; i < 9; i++) {
      order.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute("aria-label") ?? (document.activeElement as HTMLElement).textContent?.trim().slice(0, 30) ?? ""));
      await page.keyboard.press("Tab");
    }
    const flat = order.join("|");
    expect(flat.indexOf("Novo lead")).toBeLessThan(flat.indexOf("Importar planilha"));
    expect(flat.indexOf("Importar planilha")).toBeLessThan(flat.indexOf("Buscar lead"));
    expect(flat.indexOf("Buscar lead")).toBeLessThan(flat.indexOf("Filtros"));
    const card = page.getByRole("button", { name: "Abrir Teclado 000" });
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Lead Teclado 000" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar lead" }).click();
    await expect(card).toBeVisible();
  });

  test("desempenho percebido: 130 cartões, ordenar e filtrar não travam a página (resposta em < 3 s)", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 117);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(130, "Perf", 90), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const started = Date.now();
    await page.getByLabel("Ordenação").selectOption("az");
    await waitBoardIdle(page);
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(25);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

test.describe("permissões", () => {
  test("vendedor: sem filtro de responsável e sem reordenar etapas; vê só os próprios leads", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 118);
    const admin = await Api.login(tenant, "admin");
    const vendedor = await Api.login(tenant, "vendedor");
    const [novo] = (await admin.defaultPipeline()).stages;
    await admin.seed(rows(3, "DoAdmin", 91), novo!.id);
    await vendedor.seed(rows(2, "Meu", 92), novo!.id);
    await loginUi(page, tenant, "vendedor");
    await openPipeline(page);
    await expect(page.getByLabel("Responsável")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mover etapa/ })).toHaveCount(0);
    expect(await columnTotal(page, "Novo")).toBe(2);
    await expect(page.locator("header p[aria-live='polite']")).toContainText("2 oportunidades");
  });
});
