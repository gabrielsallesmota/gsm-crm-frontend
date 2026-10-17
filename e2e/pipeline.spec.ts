// E2E do Pipeline contra a API REAL (banco isolado `gsm_crm_e2e`): carregamento, ordenação global,
// movimentação e reordenação de etapas. Cada teste usa o SEU tenant (ver support/env.ts).
import { expect, test, type Page } from "@playwright/test";
import { Api, phoneOf, type ImportRow } from "./support/api";
import { cardNames, chooseOrder, column, columnTotal, loginUi, openPipeline, waitBoardIdle } from "./support/app";
import { tenantOf } from "./support/env";

const rows = (n: number, name: (i: number) => string, prefix = 1): ImportRow[] =>
  Array.from({ length: n }, (_, i) => ({ name: name(i), phone: phoneOf(prefix, i) }));
const pad = (i: number, w = 3) => String(i).padStart(w, "0");

/** Ids dos leads devolvidos pela API da tela, por etapa (para provar "sem repetir nem pular"). */
function collectLeadIds(page: Page): Map<string, string[]> {
  const byStage = new Map<string, string[]>();
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (!url.pathname.endsWith("/api/v1/leads") || response.request().method() !== "GET") return;
    const stage = url.searchParams.get("stage_id");
    if (!stage || !response.ok()) return;
    const body = (await response.json().catch(() => null)) as { items?: { id: string }[] } | null;
    const list = byStage.get(stage) ?? [];
    list.push(...(body?.items ?? []).map((l) => l.id));
    byStage.set(stage, list);
  });
  return byStage;
}

async function loadAll(page: Page, stage: string): Promise<void> {
  for (let guard = 0; guard < 20; guard++) {
    const more = column(page, stage).getByRole("button", { name: /^Carregar mais/ });
    if ((await more.count()) === 0) return;
    const before = (await column(page, stage).getByRole("button", { name: /^Abrir / }).count()) ?? 0;
    await more.click();
    await expect(column(page, stage).getByRole("button", { name: /^Abrir / })).not.toHaveCount(before);
    await waitBoardIdle(page);
  }
}

test.describe("Pipeline — carregamento", () => {
  test("poucos leads: cards, contador real e sem 'Carregar mais' @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 3);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(5, (i) => `Poucos ${i}`), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    expect(await cardNames(page, "Novo")).toHaveLength(5);
    expect(await columnTotal(page, "Novo")).toBe(5);
    await expect(page.getByRole("button", { name: /^Carregar mais/ })).toHaveCount(0);
    await expect(page.getByText("Seu funil ainda está vazio")).toHaveCount(0);
  });

  test("mais de 25 por etapa: 25 por vez, total real, 'Carregar mais' até acabar, sem repetir @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 4);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(60, (i) => `Lote ${pad(i)}`), novo!.id);
    const ids = collectLeadIds(page);
    await loginUi(page, tenant);
    await openPipeline(page);
    expect(await cardNames(page, "Novo")).toHaveLength(25);
    expect(await columnTotal(page, "Novo")).toBe(60);
    await column(page, "Novo").getByRole("button", { name: "Carregar mais (35)" }).click();
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(50);
    await column(page, "Novo").getByRole("button", { name: "Carregar mais (10)" }).click();
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(60);
    await expect(column(page, "Novo").getByRole("button", { name: /^Carregar mais/ })).toHaveCount(0);
    const seen = ids.get(novo!.id) ?? [];
    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60); // nenhum repetido, nenhum perdido
  });

  test("mais de 100 leads no quadro (130 + 40): totais reais e carregamento completo", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 5);
    const api = await Api.login(tenant);
    const [novo, contato] = (await api.defaultPipeline()).stages;
    await api.seed(rows(130, (i) => `Grande ${pad(i)}`, 2), novo!.id);
    await api.seed(rows(40, (i) => `Contato ${pad(i)}`, 3), contato!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    expect(await columnTotal(page, "Novo")).toBe(130);
    expect(await columnTotal(page, "Em contato")).toBe(40);
    await loadAll(page, "Novo");
    await loadAll(page, "Em contato");
    expect(await cardNames(page, "Novo")).toHaveLength(130);
    expect(await cardNames(page, "Em contato")).toHaveLength(40);
  });

  test("troca de pipeline mostra as etapas e os leads do pipeline escolhido", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 6);
    const api = await Api.login(tenant);
    const first = await api.defaultPipeline();
    const created = await api.request<{ id: string; stages: { id: string; name: string }[] }>("POST", "/api/v1/pipelines", {
      name: "Pós-venda",
      color: "#a78bfa",
    });
    expect(created.status).toBe(201);
    await api.seed(rows(3, (i) => `Comercial ${i}`), first.stages[0]!.id);
    const me = await api.me();
    const second = await api.importBatch(rows(2, (i) => `Posvenda ${i}`, 4), {
      pipelineId: created.body.id,
      stageId: created.body.stages[0]!.id,
      ownerId: me.id,
    });
    expect(second.status).toBe(200);
    await loginUi(page, tenant);
    await openPipeline(page);
    await expect(page.getByRole("button", { name: "Abrir Comercial 0" })).toBeVisible();
    await page.locator("select[aria-label='Pipeline']").selectOption({ label: "Pós-venda" });
    await expect(page.getByRole("button", { name: "Abrir Posvenda 0" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir Comercial 0" })).toHaveCount(0);
    await page.locator("select[aria-label='Pipeline']").selectOption({ label: "Comercial" });
    await expect(page.getByRole("button", { name: "Abrir Comercial 0" })).toBeVisible();
  });

  test("busca + responsável combinados chegam juntos ao servidor e filtram todas as colunas", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 7);
    const admin = await Api.login(tenant, "admin");
    const gestor = await Api.login(tenant, "gestor");
    const [novo] = (await admin.defaultPipeline()).stages;
    await admin.seed(
      [
        { name: "Maria Admin", phone: phoneOf(5, 1) },
        { name: "Mario Admin", phone: phoneOf(5, 2) },
        { name: "Carla Admin", phone: phoneOf(5, 3) },
      ],
      novo!.id,
    );
    await gestor.seed([{ name: "Maria Gestora", phone: phoneOf(5, 4) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(4);
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/leads?")) requests.push(r.url());
    });
    await page.getByLabel("Buscar lead", { exact: true }).fill("maria");
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(2);
    await page.getByLabel("Responsável").selectOption({ label: "Gestor t07" });
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Abrir Maria Gestora" })).toBeVisible();
    expect(requests.some((u) => u.includes("search=maria") && u.includes("owner_id="))).toBe(true);
    await page.getByLabel("Buscar lead", { exact: true }).fill("");
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(1); // segue só o responsável
  });
});

test.describe("Pipeline — ordenação GLOBAL (PIP-02)", () => {
  test("A-Z e Z-A valem para o conjunto TODO, não só para os 25 carregados @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 8);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    // o 1º em A-Z (Aaa) é o ÚLTIMO a ser criado: nunca estaria entre os 25 mais recentes carregados
    const names = Array.from({ length: 60 }, (_, i) => `Nome ${pad(59 - i)}`);
    names[59] = "Aaa Primeiro";
    await api.seed(rows(60, (i) => names[i]!, 6), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await chooseOrder(page, "az");
    const az = await cardNames(page, "Novo");
    expect(az).toHaveLength(25);
    expect(az[0]).toBe("Aaa Primeiro");
    expect(az.slice(1)).toEqual(Array.from({ length: 24 }, (_, i) => `Nome ${pad(i + 1)}`));
    await column(page, "Novo").getByRole("button", { name: "Carregar mais (35)" }).click();
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(50);
    expect((await cardNames(page, "Novo")).slice(25, 30)).toEqual(
      Array.from({ length: 5 }, (_, i) => `Nome ${pad(25 + i)}`),
    );
    await chooseOrder(page, "za");
    const za = await cardNames(page, "Novo");
    expect(za).toHaveLength(25); // trocar a ordenação recarrega do início
    expect(za[0]).toBe("Nome 059");
    expect(za[24]).toBe("Nome 035");
  });

  test("por data: mais recentes/antigos usam a data de criação de TODOS os leads", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 9);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    for (const group of ["A", "B", "C"]) {
      // lotes separados = transações separadas = datas de criação diferentes
      await api.seed(rows(20, (i) => `Grupo ${group} ${pad(i, 2)}`, 7 + group.charCodeAt(0)), novo!.id);
    }
    await loginUi(page, tenant);
    await openPipeline(page);
    await chooseOrder(page, "date_desc");
    expect((await cardNames(page, "Novo")).slice(0, 20).every((n) => n.startsWith("Grupo C"))).toBe(true);
    await chooseOrder(page, "date_asc");
    expect((await cardNames(page, "Novo")).slice(0, 20).every((n) => n.startsWith("Grupo A"))).toBe(true);
    await chooseOrder(page, "none");
    expect((await cardNames(page, "Novo")).slice(0, 20).every((n) => n.startsWith("Grupo C"))).toBe(true); // padrão = mais recentes
  });

  test("empates: nomes repetidos nunca repetem nem pulam leads entre as páginas", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 10);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(80, (i) => (i % 2 === 0 ? "Igual" : "Outro"), 8), novo!.id);
    const ids = collectLeadIds(page);
    await loginUi(page, tenant);
    await openPipeline(page);
    await chooseOrder(page, "az");
    await loadAll(page, "Novo");
    const names = await cardNames(page, "Novo");
    expect(names).toHaveLength(80);
    expect(names.slice(0, 40).every((n) => n === "Igual")).toBe(true);
    expect(names.slice(40).every((n) => n === "Outro")).toBe(true);
    // ids vindos do servidor, só da consulta ordenada: 80 distintos
    const sorted = (ids.get(novo!.id) ?? []).slice(-80);
    expect(new Set(sorted).size).toBe(80);
  });

  test("mudar a ordenação no meio da paginação reinicia a coluna na nova ordem", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 11);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(60, (i) => `Pag ${pad(i)}`, 9), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await chooseOrder(page, "az");
    await column(page, "Novo").getByRole("button", { name: "Carregar mais (35)" }).click();
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(50);
    await chooseOrder(page, "za");
    await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / })).toHaveCount(25);
    expect((await cardNames(page, "Novo"))[0]).toBe("Pag 059");
    await expect(column(page, "Novo").getByRole("button", { name: "Carregar mais (35)" })).toBeVisible();
  });

  test("resposta da ordenação ANTIGA que chega atrasada é descartada", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 12);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(30, (i) => `Corrida ${pad(i)}`, 10), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    // a consulta Z-A fica presa por 3 s; a A-Z, pedida DEPOIS, responde na hora
    await page.route(/\/api\/v1\/leads\?.*sort_dir=desc.*sort_by=name|\/api\/v1\/leads\?.*sort_by=name.*sort_dir=desc/, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.getByLabel("Ordenação").selectOption("za");
    await page.getByLabel("Ordenação").selectOption("az");
    await expect.poll(async () => (await cardNames(page, "Novo"))[0]).toBe("Corrida 000");
    await page.waitForTimeout(3500); // a resposta antiga já chegou (espera deliberada: provar que NÃO muda a tela)
    expect((await cardNames(page, "Novo"))[0]).toBe("Corrida 000");
  });

  test("ordenação respeita busca e escopo do vendedor (só os próprios leads)", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 13);
    const admin = await Api.login(tenant, "admin");
    const vendedor = await Api.login(tenant, "vendedor");
    const [novo] = (await admin.defaultPipeline()).stages;
    await admin.seed(rows(30, (i) => `Admin ${pad(i)}`, 11), novo!.id);
    await vendedor.seed(rows(3, (i) => `Minha ${i}`, 12), novo!.id);
    await loginUi(page, tenant, "vendedor");
    await openPipeline(page);
    expect(await columnTotal(page, "Novo")).toBe(3);
    await chooseOrder(page, "za");
    expect(await cardNames(page, "Novo")).toEqual(["Minha 2", "Minha 1", "Minha 0"]);
  });

  test("falha da API ao reordenar mostra o erro na coluna e permite tentar de novo", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 14);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(5, (i) => `Falha ${i}`, 13), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.route(/sort_by=name/, (route) => route.fulfill({ status: 500, body: "{}", contentType: "application/json" }));
    await page.getByLabel("Ordenação").selectOption("az");
    await expect(page.getByRole("alert").filter({ hasText: /carregar|servidor/i }).first()).toBeVisible();
    await page.unroute(/sort_by=name/);
    await page.getByRole("button", { name: "Tentar de novo" }).first().click();
    await expect(page.getByRole("button", { name: "Abrir Falha 0" })).toBeVisible();
  });
});

test.describe("Pipeline — movimentação", () => {
  async function setup(page: Page, testInfo: Parameters<typeof tenantOf>[0], n: number, count = 3) {
    const tenant = tenantOf(testInfo, n);
    const api = await Api.login(tenant);
    const stages = (await api.defaultPipeline()).stages;
    await api.seed(rows(count, (i) => `Mover ${i}`, 14 + n), stages[0]!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    return { api, stages };
  }
  const stageOfLead = async (api: Api, name: string) =>
    (await api.leads({ search: name })).find((l) => l.name === name)!.stage_id;

  test("arrastar o card para outra etapa: otimista, persiste no servidor e atualiza contadores @cross", async ({ page }, testInfo) => {
    const { api, stages } = await setup(page, testInfo, 15);
    await page.getByRole("button", { name: "Abrir Mover 0" }).dragTo(column(page, "Em contato"));
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Mover 0" })).toBeVisible();
    await expect.poll(() => stageOfLead(api, "Mover 0")).toBe(stages[1]!.id);
    expect(await columnTotal(page, "Novo")).toBe(2);
    expect(await columnTotal(page, "Em contato")).toBe(1);
    await page.reload();
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Mover 0" })).toBeVisible();
  });

  test("alternativa sem arrastar: o seletor 'mover' do cartão @cross", async ({ page }, testInfo) => {
    const { api, stages } = await setup(page, testInfo, 16);
    await page.getByLabel("Mover Mover 1 para outra etapa").selectOption({ label: "Em contato" });
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Mover 1" })).toBeVisible();
    await expect.poll(() => stageOfLead(api, "Mover 1")).toBe(stages[1]!.id);
  });

  test("pelo TECLADO: Tab até o cartão revela o seletor, e o teclado escolhe a etapa", async ({ page }, testInfo) => {
    const { api, stages } = await setup(page, testInfo, 17);
    const card = page.getByRole("button", { name: "Abrir Mover 2" });
    await card.focus();
    await page.keyboard.press("Tab"); // próximo foco do cartão: o seletor de etapa
    const select = page.getByLabel("Mover Mover 2 para outra etapa");
    await expect(select).toBeFocused();
    await expect(select).toBeVisible();
    const box = await select.boundingBox();
    expect(box && box.width > 40 && box.height > 16).toBe(true); // apareceu de verdade (não é o clip de 1 px)
    await page.keyboard.press("ArrowDown");
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Mover 2" })).toBeVisible();
    await expect.poll(() => stageOfLead(api, "Mover 2")).toBe(stages[1]!.id);
  });

  test("rollback: se a API falha o card volta para a etapa de origem e o erro é avisado", async ({ page }, testInfo) => {
    const { api, stages } = await setup(page, testInfo, 18);
    await page.route(/\/api\/v1\/leads\/[^/]+\/move/, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ detail: "falha simulada" }), contentType: "application/json" }),
    );
    await page.getByLabel("Mover Mover 0 para outra etapa").selectOption({ label: "Em contato" });
    await expect(page.getByText(/falha simulada|Erro inesperado|voltou para a etapa anterior|Não foi possível mover/i).first()).toBeVisible();
    await expect(column(page, "Novo").getByRole("button", { name: "Abrir Mover 0" })).toBeVisible();
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Mover 0" })).toHaveCount(0);
    expect(await columnTotal(page, "Novo")).toBe(3);
    expect(await stageOfLead(api, "Mover 0")).toBe(stages[0]!.id);
  });

  test("estado de carregamento: o cartão fica ocupado (aria-busy) enquanto o movimento está em voo", async ({ page }, testInfo) => {
    await setup(page, testInfo, 19);
    await page.route(/\/api\/v1\/leads\/[^/]+\/move/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.getByLabel("Mover Mover 0 para outra etapa").selectOption({ label: "Em contato" });
    const busyCard = page.locator("[aria-busy='true']").filter({ has: page.getByRole("button", { name: "Abrir Mover 0" }) });
    await expect(busyCard).toHaveCount(1);
    await expect(busyCard).toHaveCount(0, { timeout: 10_000 });
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Mover 0" })).toBeVisible();
  });
});

test.describe("Pipeline — reordenar etapas", () => {
  const stageNamesInOrder = async (page: Page) =>
    page.locator("span[class*='columnLabel']").evaluateAll((els) => els.map((e) => (e.textContent ?? "").replace(/🏆|✕/gu, "").trim()));

  test("por TECLADO: botão da etapa, feedback com a posição, foco preservado e ordem persistida @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 20);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed(rows(1, () => "Qualquer", 40), novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    expect(await stageNamesInOrder(page)).toEqual(["Novo", "Em contato", "Ganho", "Perdido"]);
    const right = page.getByRole("button", { name: "Mover etapa Novo para a direita" });
    await right.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Etapa Novo movida para a posição 2 de 4")).toBeVisible();
    await expect.poll(() => stageNamesInOrder(page)).toEqual(["Em contato", "Novo", "Ganho", "Perdido"]);
    await expect(page.getByRole("button", { name: "Mover etapa Novo para a direita" })).toBeFocused();
    const persisted = (await api.defaultPipeline()).stages.map((s) => s.name);
    expect(persisted).toEqual(["Em contato", "Novo", "Ganho", "Perdido"]);
    // as pontas ficam desabilitadas
    await expect(page.getByRole("button", { name: "Mover etapa Em contato para a esquerda" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Mover etapa Perdido para a direita" })).toBeDisabled();
  });

  test("por MOUSE: arrastar o cabeçalho da etapa troca a ordem", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 21);
    await Api.login(tenant);
    await loginUi(page, tenant);
    await openPipeline(page);
    const header = column(page, "Novo").locator("div[class*='columnHeader']");
    await header.dragTo(column(page, "Ganho"));
    await expect(page.getByText("Ordem das etapas atualizada")).toBeVisible();
    await expect.poll(() => stageNamesInOrder(page)).toEqual(["Em contato", "Ganho", "Novo", "Perdido"]);
  });

  test("permissão: gestor reordena; vendedor não vê os controles nem arrasta a coluna", async ({ page, browser }, testInfo) => {
    const tenant = tenantOf(testInfo, 22);
    await loginUi(page, tenant, "gestor");
    await openPipeline(page);
    await expect(page.getByRole("button", { name: /^Mover etapa/ })).toHaveCount(8);
    const other = await browser.newContext();
    const vendedorPage = await other.newPage();
    await loginUi(vendedorPage, tenant, "vendedor");
    await openPipeline(vendedorPage);
    await expect(vendedorPage.getByRole("button", { name: /^Mover etapa/ })).toHaveCount(0);
    expect(await column(vendedorPage, "Novo").locator("div[class*='columnHeader']").getAttribute("draggable")).toBe("false");
    await other.close();
  });

  test("falha da API ao reordenar: erro avisado e a ordem na tela não muda", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 23);
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.route(/\/stages\/reorder/, (route) =>
      route.fulfill({ status: 403, body: JSON.stringify({ detail: "Sem permissão para reordenar" }), contentType: "application/json" }),
    );
    await page.getByRole("button", { name: "Mover etapa Novo para a direita" }).click();
    await expect(page.getByText(/Sem permissão para reordenar/).first()).toBeVisible();
    expect(await stageNamesInOrder(page)).toEqual(["Novo", "Em contato", "Ganho", "Perdido"]);
  });
});

test.describe("Pipeline — posição do card após mover (R5)", () => {
  test("o card movido aparece na etapa de destino de imediato e, após recarregar, na posição ordenada do servidor", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 57);
    const api = await Api.login(tenant);
    const [novo, contato] = (await api.defaultPipeline()).stages;
    await api.seed(rows(3, (i) => `Beta ${i}`, 15), contato!.id);
    await api.seed([{ name: "Alfa", phone: phoneOf(16, 1) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await chooseOrder(page, "az");
    await page.getByLabel("Mover Alfa para outra etapa").selectOption({ label: "Em contato" });
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Alfa" })).toBeVisible();
    // posição otimista (até a próxima carga): caracterizada, sem exigir uma posição específica
    const optimistic = await cardNames(page, "Em contato");
    expect(optimistic.sort()).toEqual(["Alfa", "Beta 0", "Beta 1", "Beta 2"]);
    await page.reload();
    await chooseOrder(page, "az");
    expect(await cardNames(page, "Em contato")).toEqual(["Alfa", "Beta 0", "Beta 1", "Beta 2"]); // ordem real do servidor
  });
});
