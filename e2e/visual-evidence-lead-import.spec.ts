// Evidências VISUAIS do painel do lead e do assistente de CSV (Prompt 07): capturas REAIS do app em
// execução contra a API isolada, com dados FICTÍCIOS. Saída: docs/ux-redesign/fase-3-lead-import/evidencias/.
// Tenants 126–135 (só Chromium). As capturas documentam o estado; o comportamento é dos testes funcionais.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import { importButton, importDialog, loginUi, openImport, openPipeline } from "./support/app";
import { file, holdBatches, toCsv, validCsv } from "./support/csv";
import { tenantOf } from "./support/env";

const OUT = "docs/ux-redesign/fase-3-lead-import/evidencias";
mkdirSync(OUT, { recursive: true });

const setTheme = (page: Page, theme: "light" | "dark") =>
  page.addInitScript((t) => localStorage.setItem("gsm_theme", t), theme);
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });

async function seedMariana(tenant: number) {
  const api = await Api.login(tenant);
  const [novo] = (await api.defaultPipeline()).stages;
  const me = await api.me();
  const lead = await api.createLead({
    name: "Mariana Albuquerque",
    stageId: novo!.id,
    ownerId: me.id,
    company: "Clínica Vitalis",
    phone: "11987654321",
    email: "mariana@clinicavitalis.example.com",
    value: 4800,
    origin: "instagram",
  });
  const comments = [
    "Pediu orçamento para três profissionais",
    "Liguei e deixei recado; retorna na sexta",
    "Cliente comparou com outro fornecedor e quer desconto no plano anual",
    "Enviei a proposta revisada por e-mail",
    "Reunião de alinhamento marcada para a próxima semana",
  ];
  for (const text of comments) await api.comment(lead.id, text);
  return { api, lead };
}

async function openDrawer(page: Page, tenant: number) {
  await loginUi(page, tenant);
  await openPipeline(page);
  await page.getByRole("button", { name: "Abrir Mariana Albuquerque" }).click();
  const d = page.getByRole("dialog", { name: "Lead Mariana Albuquerque" });
  await expect(d.getByText("Reunião de alinhamento marcada")).toBeVisible();
  return d;
}

for (const [i, theme] of (["light", "dark"] as const).entries()) {
  test(`Painel do lead desktop · ${theme}`, async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 126 + i);
    await seedMariana(tenant);
    await page.setViewportSize({ width: 1366, height: 768 });
    await setTheme(page, theme);
    await openDrawer(page, tenant);
    await shot(page, `drawer-desktop-${theme === "light" ? "claro" : "escuro"}`);
  });
}

test("Painel do lead no celular, em edição e a timeline", async ({ page }, testInfo) => {
  const tenant = tenantOf(testInfo, 128);
  await seedMariana(tenant);
  await page.setViewportSize({ width: 390, height: 844 });
  const d = await openDrawer(page, tenant);
  await shot(page, "drawer-mobile");
  await d.getByRole("button", { name: /Editar/ }).click();
  await d.getByLabel("E-mail", { exact: true }).fill("mariana-sem-arroba");
  await d.getByLabel("Empresa").focus();
  await shot(page, "drawer-mobile-edicao-validacao");

  await page.setViewportSize({ width: 1366, height: 900 });
  await d.getByLabel("Nome").focus();
  await shot(page, "drawer-edicao");
  await d.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("dialog", { name: "Descartar alterações?" }).getByRole("button", { name: "Descartar" }).click();
  await d.getByRole("region", { name: "Atividades" }).scrollIntoViewIfNeeded();
  await d.getByLabel("Novo comentário").focus();
  await shot(page, "drawer-timeline");
});

async function startImport(page: Page, tenant: number) {
  await loginUi(page, tenant);
  await openPipeline(page);
  await openImport(page);
}

test("Assistente CSV: arquivo, colunas, revisão, progresso e resultado", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const tenant = tenantOf(testInfo, 129);
  const api = await Api.login(tenant);
  const [novo] = (await api.defaultPipeline()).stages;
  await api.seed([{ name: "Já Existe Silva", phone: phoneOf(70, 1) }], novo!.id);
  await page.setViewportSize({ width: 1366, height: 820 });
  await startImport(page, tenant);
  await shot(page, "csv-1-arquivo");

  const rows: string[][] = [["Nome completo", "Celular", "E-mail", "Empresa", "Origem do contato", "Observação interna"]];
  const names = ["Ana Beatriz Lopes", "Carlos Henrique Maia", "Daniela Freitas", "Eduardo Peixoto", "Fabiana Rangel", "Gilberto Sá"];
  names.forEach((n, i) => rows.push([n, phoneOf(70, i + 2), `${n.split(" ")[0]!.toLowerCase()}@example.com`, `Empresa ${i + 1}`, "instagram", "importado do evento"]));
  rows.push(["Já Existe Silva", phoneOf(70, 1), "", "", "", ""]); // duplicado
  rows.push(["", phoneOf(70, 90), "", "", "", ""]); // sem nome
  await importDialog(page).getByLabel("Arquivo CSV com os leads").setInputFiles(file(toCsv(rows)));
  await expect(importDialog(page).getByText(/8 linha[(]s[)] encontrada/)).toBeVisible();
  await importDialog(page).getByLabel("Campo do lead para a coluna Nome completo").selectOption("name");
  await importDialog(page).getByLabel("Campo do lead para a coluna Celular").selectOption("phone");
  await importDialog(page).getByLabel("Campo do lead para a coluna Origem do contato").selectOption("origin");
  await shot(page, "csv-2-colunas");

  await importDialog(page).getByRole("button", { name: "Continuar" }).click();
  await expect(importDialog(page).getByRole("region", { name: "Pré-importação" })).toBeVisible();
  await shot(page, "csv-3-revisao");

  const held = await holdBatches(page);
  await importButton(page).click();
  const first = await held.next();
  await expect(importDialog(page).getByRole("progressbar", { name: "Progresso da importação" })).toBeVisible();
  await shot(page, "csv-4-progresso");
  await first.release();
  await expect(importDialog(page).getByText("Concluído com erros", { exact: true })).toBeVisible();
  await held.stop();
  await shot(page, "csv-5-resultado");
});

test("Assistente CSV no celular (colunas e revisão)", async ({ page }, testInfo) => {
  const tenant = tenantOf(testInfo, 130);
  await page.setViewportSize({ width: 390, height: 844 });
  await startImport(page, tenant);
  await importDialog(page).getByLabel("Arquivo CSV com os leads").setInputFiles(file(validCsv(12, 71)));
  await expect(importDialog(page).getByText(/12 linha[(]s[)] encontrada/)).toBeVisible();
  await shot(page, "csv-mobile-colunas");
  await importDialog(page).getByRole("button", { name: "Continuar" }).click();
  await shot(page, "csv-mobile-revisao");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
