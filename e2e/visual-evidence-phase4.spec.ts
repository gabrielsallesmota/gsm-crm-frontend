// Evidências VISUAIS da fase 4 (Prompt 08): capturas REAIS do app em execução contra a API isolada,
// com dados FICTÍCIOS. Saída: docs/ux-redesign/fase-4-settings-final-qa/evidencias/. Tenants 187–195.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import { importButton, importDialog, loginUi, openImport, openPipeline } from "./support/app";
import { file, holdBatches, toCsv } from "./support/csv";
import { tenantOf } from "./support/env";

const OUT = "docs/ux-redesign/fase-4-settings-final-qa/evidencias";
mkdirSync(OUT, { recursive: true });

const NAMES = [
  "Mariana Albuquerque", "Rafael Tavares", "Beatriz Nogueira", "Carlos Eduardo Menezes", "Fernanda Lacerda",
  "Thiago Barbosa", "Juliana Prado", "Ricardo Amaral", "Patrícia Lima", "Bruno Teixeira", "Larissa Gomes",
  "André Cordeiro", "Camila Duarte", "Eduardo Faria", "Helena Rocha", "Gustavo Pires", "Aline Cavalcante",
];
const COMPANIES = ["Clínica Vitalis", "Odonto Sorriso", "Studio Bem-Estar", "Pet Care Vila Nova", "Academia Movimento", "Contábil Prado"];
const ORIGINS = ["whatsapp", "instagram", "landing_page", "google", "facebook", "manual"];

const setTheme = (page: Page, theme: "light" | "dark") =>
  page.addInitScript((t) => localStorage.setItem("gsm_theme", t), theme);
const shot = async (page: Page, name: string) => {
  // só fotografa com as animações de entrada terminadas (senão o diálogo sai translúcido)
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

async function seedBoard(tenant: number) {
  const api = await Api.login(tenant);
  const me = await api.me();
  const stages = (await api.defaultPipeline()).stages;
  const plan: [number, number, number][] = [[0, 0, 7], [1, 7, 5], [2, 12, 3], [3, 15, 2]];
  let first = "";
  for (const [stageIndex, from, count] of plan) {
    for (let i = 0; i < count; i++) {
      const idx = from + i;
      const lead = await api.createLead({
        name: NAMES[idx % NAMES.length]!,
        stageId: stages[stageIndex]!.id,
        ownerId: me.id,
        company: COMPANIES[idx % COMPANIES.length]!,
        phone: phoneOf(64, idx),
        email: `contato${idx}@example.com`,
        value: (idx % 6 + 1) * 1800,
        origin: ORIGINS[idx % ORIGINS.length]!,
      });
      if (!first) first = lead.id;
    }
  }
  for (const text of ["Pediu orçamento para três profissionais", "Enviei a proposta revisada por e-mail"]) await api.comment(first, text);
  await api.request("POST", "/api/v1/tags", { label: "VIP", color: "#2a9d8f", bg: "rgba(42,157,143,.14)" });
  await api.request("POST", "/api/v1/tags", { label: "Indicação", color: "#e76f51", bg: "rgba(231,111,81,.14)" });
  return api;
}

for (const [i, theme] of (["light", "dark"] as const).entries()) {
  test(`Pipeline desktop · ${theme}`, async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 187 + i);
    await seedBoard(tenant);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, theme);
    await loginUi(page, tenant);
    await openPipeline(page);
    await expect(page.getByRole("button", { name: /^Abrir / }).first()).toBeVisible();
    await shot(page, `01-pipeline-desktop-${theme === "light" ? "claro" : "escuro"}`);
  });
}

test("Pipeline mobile, painel do lead (desktop e mobile) e confirmação de lead perdido", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const tenant = tenantOf(testInfo, 189);
  await seedBoard(tenant);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginUi(page, tenant);
  await openPipeline(page);
  await expect(page.getByRole("button", { name: /^Abrir / }).first()).toBeVisible();
  await shot(page, "03-pipeline-mobile");
  await page.getByRole("button", { name: "Abrir Mariana Albuquerque" }).click();
  await expect(page.getByRole("dialog", { name: "Lead Mariana Albuquerque" }).getByText("Enviei a proposta revisada")).toBeVisible();
  await shot(page, "05-drawer-mobile");

  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, "04-drawer-desktop");
  await page.getByRole("dialog", { name: "Lead Mariana Albuquerque" }).getByRole("button", { name: "Fechar lead" }).click();

  // confirmação de lead perdido (seletor "mover" do cartão)
  await page.getByLabel("Mover Rafael Tavares para outra etapa").selectOption({ label: "Perdido" });
  await expect(page.getByRole("dialog", { name: "Marcar como perdido?" })).toBeVisible();
  await shot(page, "17-confirmacao-lead-perdido");
  await page.getByRole("dialog", { name: "Marcar como perdido?" }).getByRole("button", { name: "Cancelar" }).click();
});

test("Assistente CSV: seleção, mapeamento, revisão, progresso e resultado", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const tenant = tenantOf(testInfo, 190);
  const api = await Api.login(tenant);
  const [novo] = (await api.defaultPipeline()).stages;
  await api.seed([{ name: "Já Existe Silva", phone: phoneOf(65, 1) }], novo!.id);
  await page.setViewportSize({ width: 1366, height: 820 });
  await loginUi(page, tenant);
  await openPipeline(page);
  await openImport(page);
  await shot(page, "06-csv-selecao");
  const rows: string[][] = [["Nome completo", "Celular", "E-mail", "Empresa", "Origem do contato", "Observação interna"]];
  ["Ana Beatriz Lopes", "Carlos Henrique Maia", "Daniela Freitas", "Eduardo Peixoto", "Fabiana Rangel", "Gilberto Sá"].forEach((n, i) =>
    rows.push([n, phoneOf(65, i + 2), `${n.split(" ")[0]!.toLowerCase()}@example.com`, `Empresa ${i + 1}`, "instagram", "importado do evento"]),
  );
  rows.push(["Já Existe Silva", phoneOf(65, 1), "", "", "", ""]);
  rows.push(["", phoneOf(65, 90), "", "", "", ""]);
  const dialog = importDialog(page);
  await dialog.getByLabel("Arquivo CSV com os leads").setInputFiles(file(toCsv(rows)));
  await expect(dialog.getByText(/8 linha[(]s[)] encontrada/)).toBeVisible();
  await dialog.getByLabel("Campo do lead para a coluna Nome completo").selectOption("name");
  await dialog.getByLabel("Campo do lead para a coluna Celular").selectOption("phone");
  await dialog.getByLabel("Campo do lead para a coluna Origem do contato").selectOption("origin");
  await shot(page, "07-csv-mapeamento");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByRole("region", { name: "Pré-importação" })).toBeVisible();
  await shot(page, "08-csv-revisao");
  const held = await holdBatches(page);
  await importButton(page).click();
  const first = await held.next();
  await expect(dialog.getByRole("progressbar", { name: "Progresso da importação" })).toBeVisible();
  await shot(page, "09-csv-progresso");
  await first.release();
  await expect(dialog.getByText("Concluído com erros", { exact: true })).toBeVisible();
  await held.stop();
  await shot(page, "10-csv-resultado");
});

test("Configurações: visão geral, pipelines, etapas, tags, templates e celular", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const tenant = tenantOf(testInfo, 191);
  const api = await seedBoard(tenant);
  const stages = (await api.defaultPipeline()).stages;
  await api.request("POST", "/api/v1/lead-message-templates", {
    stage_id: stages[0]!.id, origin: "whatsapp", message: "Olá {nome}, tudo bem? Vi seu contato pela {empresa} e posso te ajudar.",
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, tenant);
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await shot(page, "11-config-visao-geral");

  const pipelines = page.getByRole("region", { name: "Pipelines e etapas" });
  await pipelines.scrollIntoViewIfNeeded();
  await shot(page, "12-config-pipelines");

  await pipelines.getByRole("button", { name: /^Em contato/ }).click();
  await expect(pipelines.getByLabel("Nome da etapa")).toBeVisible();
  await shot(page, "13-config-etapas");
  await pipelines.getByRole("button", { name: "Cancelar" }).click();

  await page.getByRole("region", { name: "Tags" }).scrollIntoViewIfNeeded();
  await shot(page, "14-config-tags");

  await page.getByRole("button", { name: /Mensagens de WhatsApp/ }).click();
  await expect(page.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeVisible();
  await shot(page, "15-config-templates");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/configuracoes");
  await expect(page.getByLabel("Seção")).toBeVisible();
  await shot(page, "16-config-mobile");
});
