// E2E das Configurações redesenhadas (Prompt 08) e da confirmação de "perdido" em TODOS os caminhos do
// quadro (D-03), contra a API real. Tenants 151–170 (faixa extra do Chromium; ver support/env.ts).
import { expect, test, type Page } from "@playwright/test";
import { Api, phoneOf } from "./support/api";
import { column, loginUi, openPipeline } from "./support/app";
import { tenantOf } from "./support/env";

const openSettings = async (page: Page, query = "") => {
  await page.goto(`/configuracoes${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
};
const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("Configurações — navegação e categorias", () => {
  test("categorias por ?secao, voltar do navegador, link compartilhável e área interna só para staff", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 151);
    await loginUi(page, tenant);
    await openSettings(page);
    const nav = page.getByRole("navigation", { name: "Seções das configurações" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pipelines e etapas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tags" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Origens" })).toBeVisible();

    await nav.getByRole("button", { name: /Mensagens de WhatsApp/ }).click();
    await expect(page).toHaveURL(/secao=comunicacao/);
    await expect(page.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pipelines e etapas" })).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole("heading", { name: "Pipelines e etapas" })).toBeVisible();

    // link compartilhável
    await openSettings(page, "?secao=comunicacao");
    await expect(page.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeVisible();

    // cliente comum NUNCA vê a área interna, nem forçando a URL
    await openSettings(page, "?secao=interno");
    await expect(page.getByRole("heading", { name: "Pipelines e etapas" })).toBeVisible();
    await expect(page.getByText(/Prospecção — /)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Prospecção \(GSM\)/ })).toHaveCount(0);
  });

  test("atalhos para telas vizinhas aparecem só para quem pode usá-las; menu lateral com UM item ativo", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 152);
    await loginUi(page, tenant);
    await openSettings(page);
    const nav = page.getByRole("navigation", { name: "Seções das configurações" });
    await expect(nav.getByRole("link", { name: "Equipe e usuários" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Automações comerciais" })).toBeVisible();
    await page.goto("/configuracoes/integracoes");
    await expect(page.getByRole("heading", { name: "Integrações", level: 1 })).toBeVisible();
    const main = page.getByRole("navigation", { name: "Menu principal" });
    await expect(main.locator("[aria-current='page']")).toHaveCount(1);
    await expect(main.getByRole("link", { name: "Integrações" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Configurações — pipelines, etapas, tags e templates", () => {
  test("pipelines e etapas: criar, editar (Ganho/Perdido exclusivos), reordenar e excluir com os avisos de impacto", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 153);
    const api = await Api.login(tenant);
    await loginUi(page, tenant);
    await openSettings(page);

    await page.getByLabel("Nome do novo pipeline").fill("Pós-venda");
    await page.getByRole("button", { name: "Adicionar" }).first().click();
    await expect(page.getByText("Pipeline criado")).toBeVisible();
    const card = page.locator("[class*='pipelineCard']").filter({ hasText: "Pós-venda" });
    await expect(card).toBeVisible();

    // etapa nova
    await card.getByRole("button", { name: "+ Etapa" }).click();
    await page.getByLabel("Nome da nova etapa").fill("Renovação");
    await card.getByRole("button", { name: "Adicionar" }).click();
    await expect(card.getByRole("button", { name: /^Renovação/ })).toBeVisible();

    // editar: Ganho e Perdido exclusivos + aviso do D-03
    await card.getByRole("button", { name: /^Renovação/ }).click();
    await card.getByLabel("Perdido").check();
    await card.getByLabel("Ganho").check();
    await expect(card.getByLabel("Perdido")).not.toBeChecked();
    await expect(card.getByText(/Mover um lead para uma etapa Perdido pede confirmação/)).toBeVisible();
    await card.getByLabel("Perdido").check();
    await card.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Etapa atualizada")).toBeVisible();
    await expect(card.getByRole("button", { name: /Renovação ✕/ })).toBeVisible();

    // excluir a etapa: o aviso cita os templates; cancelar mantém
    await card.getByRole("button", { name: /Renovação/ }).click();
    await card.getByRole("button", { name: "Excluir", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Excluir etapa?" });
    await expect(confirm).toContainText("templates de mensagem de WhatsApp");
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(card.getByLabel("Nome da etapa")).toHaveValue("Renovação"); // continua em edição, nada excluído
    await card.getByRole("button", { name: "Excluir", exact: true }).click();
    await page.getByRole("dialog", { name: "Excluir etapa?" }).getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Etapa excluída")).toBeVisible();

    // excluir o pipeline (não padrão): confirmação e remoção
    await card.getByRole("button", { name: "Excluir pipeline Pós-venda" }).click();
    await expect(page.getByRole("dialog", { name: "Excluir pipeline?" })).toContainText("Só é possível excluir um pipeline sem leads");
    await page.getByRole("dialog", { name: "Excluir pipeline?" }).getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Pipeline excluído")).toBeVisible();
    expect((await api.pipelines()).map((p) => p.name)).not.toContain("Pós-venda");
  });

  test("tags: criar e remover com confirmação (os leads não são excluídos)", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 154);
    await loginUi(page, tenant);
    await openSettings(page);
    await expect(page.getByText(/Nenhuma tag criada ainda/)).toBeVisible();
    await page.getByLabel("Nome da nova tag").fill("VIP");
    await page.getByRole("button", { name: "Adicionar" }).nth(1).click();
    await expect(page.getByText("Tag criada")).toBeVisible();
    await page.getByRole("button", { name: "Remover tag VIP" }).click();
    const confirm = page.getByRole("dialog", { name: "Remover tag?" });
    await expect(confirm).toContainText("Os leads não são excluídos");
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("button", { name: "Remover tag VIP" })).toBeVisible();
    await page.getByRole("button", { name: "Remover tag VIP" }).click();
    await page.getByRole("dialog", { name: "Remover tag?" }).getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Tag removida")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover tag VIP" })).toHaveCount(0);
  });

  test("origens: conjunto fixo e somente leitura (D-04)", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 155);
    await loginUi(page, tenant);
    await openSettings(page);
    const section = page.getByRole("region", { name: "Origens" });
    await expect(section.getByRole("listitem")).toHaveCount(8);
    await expect(section.getByRole("button")).toHaveCount(0);
    await expect(section.getByRole("textbox")).toHaveCount(0);
  });

  test("template de WhatsApp: criar por etapa e origem, recusar duplicado e excluir com confirmação", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 156);
    await loginUi(page, tenant);
    await openSettings(page, "?secao=comunicacao");
    await page.getByLabel("Etapa do template").selectOption({ label: "Novo" });
    await page.getByLabel("Origem do template").selectOption({ label: "WhatsApp" });
    await page.getByLabel("Mensagem do template").fill("Olá {nome}, tudo bem?");
    await page.getByRole("button", { name: "Adicionar template" }).click();
    await expect(page.getByText("Olá {nome}, tudo bem?").first()).toBeVisible();
    // o formulário reinicia (mensagem e origem) DEPOIS de salvar: espera isso antes de preencher de novo
    await expect(page.getByText("Template criado")).toBeVisible();
    await expect(page.getByLabel("Mensagem do template")).toHaveValue("");
    await expect(page.getByLabel("Origem do template")).toHaveValue("");
    // mesma etapa + origem: o servidor recusa e o erro aparece no formulário
    await page.getByLabel("Etapa do template").selectOption({ label: "Novo" });
    await page.getByLabel("Origem do template").selectOption({ label: "WhatsApp" });
    await page.getByLabel("Mensagem do template").fill("Outra mensagem");
    await expect(page.getByLabel("Mensagem do template")).toHaveValue("Outra mensagem");
    await page.getByRole("button", { name: "Adicionar template" }).click();
    await expect(page.getByText(/já existe|duplic|mesma/i).first()).toBeVisible();
    // excluir
    await page.getByRole("button", { name: "Excluir" }).first().click();
    const confirm = page.getByRole("dialog", { name: "Excluir template?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Olá {nome}, tudo bem?")).toHaveCount(0);
  });

  test("celular 390×844: seletor de seção, atalhos em cartões e sem rolagem horizontal", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 157);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginUi(page, tenant);
    await openSettings(page);
    const select = page.getByLabel("Seção");
    await expect(select).toBeVisible();
    await expect(page.getByRole("link", { name: "Equipe e usuários" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    await select.selectOption({ label: "Mensagens de WhatsApp" });
    await expect(page.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("Configurações — permissões (o backend é a autoridade)", () => {
  test("vendedor não acessa Configurações pela interface nem pela API; gestor acessa; isolamento entre tenants (IDOR)", async ({ page }, testInfo) => {
    const tenantA = tenantOf(testInfo, 158);
    const tenantB = tenantOf(testInfo, 159);
    const vendedor = await Api.login(tenantA, "vendedor");
    const gestor = await Api.login(tenantA, "gestor");
    const adminB = await Api.login(tenantB, "admin");
    const pipelineB = await adminB.defaultPipeline();
    const tagB = await adminB.request<{ id: string }>("POST", "/api/v1/tags", { label: "Segredo B", color: "#ff0000", bg: "rgba(255,0,0,.14)" });
    expect(tagB.status).toBe(201);

    // API: vendedor recusado em toda escrita de configuração
    for (const [method, path, body] of [
      ["POST", "/api/v1/pipelines", { name: "X", color: "#000000" }],
      ["POST", "/api/v1/tags", { label: "X", color: "#000000", bg: "rgba(0,0,0,.1)" }],
      ["PATCH", `/api/v1/pipelines/${(await vendedor.defaultPipeline()).id}`, { name: "Hackeado" }],
    ] as const) {
      const r = await vendedor.request(method, path, body);
      expect([401, 403], `${method} ${path}`).toContain(r.status);
    }
    // API: gestor pode (settings.manage = ADMIN e GESTOR)
    expect((await gestor.request("POST", "/api/v1/tags", { label: "Do gestor", color: "#00ff00", bg: "rgba(0,255,0,.14)" })).status).toBe(201);

    // IDOR: o admin de A não enxerga nem altera dados do tenant B
    const adminA = await Api.login(tenantA, "admin");
    const patch = await adminA.request("PATCH", `/api/v1/pipelines/${pipelineB.id}`, { name: "Invadido" });
    expect([403, 404]).toContain(patch.status);
    const del = await adminA.request("DELETE", `/api/v1/tags/${tagB.body.id}`);
    expect([403, 404]).toContain(del.status);
    expect((await adminA.request<{ label: string }[]>("GET", "/api/v1/tags")).body.map((t) => t.label)).not.toContain("Segredo B");
    expect((await adminB.pipelines())[0]!.name).not.toBe("Invadido");

    // UI: vendedor não vê o item no menu e a rota não renderiza a página
    await loginUi(page, tenantA, "vendedor");
    await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toHaveCount(0);
  });
});

test.describe("D-03 — confirmação ao marcar como perdido (todos os caminhos do quadro)", () => {
  async function setup(page: Page, testInfo: Parameters<typeof tenantOf>[0], n: number) {
    const tenant = tenantOf(testInfo, n);
    const api = await Api.login(tenant);
    const stages = (await api.defaultPipeline()).stages;
    await api.seed([{ name: "Lead Perda", phone: phoneOf(60 + (n % 30), 1) }], stages[0]!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const stageOf = async () => (await api.leads({ search: "Lead Perda" }))[0]!.stage_id;
    return { api, stages, stageOf };
  }

  test("seletor 'mover': confirma antes; cancelar preserva a etapa; confirmar grava", async ({ page }, testInfo) => {
    const { stages, stageOf } = await setup(page, testInfo, 160);
    const move = page.getByLabel("Mover Lead Perda para outra etapa");
    await move.selectOption({ label: "Perdido" });
    const dialog = page.getByRole("dialog", { name: "Marcar como perdido?" });
    await expect(dialog).toContainText('"Lead Perda" será movido para "Perdido"');
    expect(await stageOf()).toBe(stages[0]!.id); // nada gravado antes de confirmar
    await expect(column(page, "Novo").getByRole("button", { name: "Abrir Lead Perda" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(column(page, "Novo").getByRole("button", { name: "Abrir Lead Perda" })).toBeVisible();
    expect(await stageOf()).toBe(stages[0]!.id);
    await move.selectOption({ label: "Perdido" });
    await page.getByRole("dialog", { name: "Marcar como perdido?" }).getByRole("button", { name: "Marcar como perdido" }).click();
    await expect(column(page, "Perdido").getByRole("button", { name: "Abrir Lead Perda" })).toBeVisible();
    await expect.poll(stageOf).toBe(stages[3]!.id);
  });

  test("arrastar para a coluna Perdido: confirma antes de mover (nada otimista até confirmar)", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 }); // as 4 colunas à vista (alvo do arraste)
    const { stages, stageOf } = await setup(page, testInfo, 161);
    await page.getByRole("button", { name: "Abrir Lead Perda" }).dragTo(column(page, "Perdido"));
    const dialog = page.getByRole("dialog", { name: "Marcar como perdido?" });
    await expect(dialog).toBeVisible();
    await expect(column(page, "Novo").getByRole("button", { name: "Abrir Lead Perda" })).toBeVisible();
    expect(await stageOf()).toBe(stages[0]!.id);
    await dialog.getByRole("button", { name: "Marcar como perdido" }).click();
    await expect.poll(stageOf).toBe(stages[3]!.id);
  });

  test("pelo painel do lead: UMA confirmação só; ganho não pede confirmação", async ({ page }, testInfo) => {
    const { stages, stageOf } = await setup(page, testInfo, 162);
    await page.getByRole("button", { name: "Abrir Lead Perda" }).click();
    const drawer = page.getByRole("dialog", { name: "Lead Lead Perda" });
    await drawer.getByLabel("Etapa").selectOption({ label: "Ganho (ganho)" });
    await expect(page.getByRole("dialog", { name: "Marcar como perdido?" })).toHaveCount(0);
    await expect.poll(stageOf).toBe(stages[2]!.id);
    await drawer.getByLabel("Etapa").selectOption({ label: "Perdido (perdido)" });
    await expect(page.getByRole("dialog", { name: "Marcar como perdido?" })).toHaveCount(1);
    await page.getByRole("dialog", { name: "Marcar como perdido?" }).getByRole("button", { name: "Marcar como perdido" }).click();
    await expect.poll(stageOf).toBe(stages[3]!.id);
  });

  test("falha do servidor depois de confirmar: o lead volta para a etapa de origem e o erro é avisado", async ({ page }, testInfo) => {
    const { stages, stageOf } = await setup(page, testInfo, 163);
    await page.route("**/api/v1/leads/*/move", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"falhou"}' }));
    await page.getByLabel("Mover Lead Perda para outra etapa").selectOption({ label: "Perdido" });
    await page.getByRole("dialog", { name: "Marcar como perdido?" }).getByRole("button", { name: "Marcar como perdido" }).click();
    await expect(page.getByText(/Erro inesperado no servidor/)).toBeVisible();
    await expect(column(page, "Novo").getByRole("button", { name: "Abrir Lead Perda" })).toBeVisible();
    expect(await stageOf()).toBe(stages[0]!.id);
  });

  test("movimentação normal (Novo → Em contato) NÃO pede confirmação", async ({ page }, testInfo) => {
    const { stages, stageOf } = await setup(page, testInfo, 164);
    await page.getByLabel("Mover Lead Perda para outra etapa").selectOption({ label: "Em contato" });
    await expect(page.getByRole("dialog", { name: "Marcar como perdido?" })).toHaveCount(0);
    await expect.poll(stageOf).toBe(stages[1]!.id);
  });
});
