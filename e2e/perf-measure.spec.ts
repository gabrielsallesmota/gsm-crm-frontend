// MEDIÇÃO MANUAL de desempenho do frontend (Prompt 08). Só roda com RUN_PERF=1:
//   RUN_PERF=1 npx playwright test e2e/perf-measure.spec.ts --project=chromium
// Chromium no Windows, API local, dados FICTÍCIOS. Sem linha de base anterior: os números são
// ABSOLUTOS desta máquina e só servem para achar gargalos grosseiros (requisições duplicadas, tarefas
// longas). Escreve e2e/.artifacts/perf-measure.json.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import { importDialog, loginUi, openImport, openPipeline } from "./support/app";
import { file, validCsv } from "./support/csv";
import { tenantOf } from "./support/env";

test.skip(!process.env.RUN_PERF, "medição manual (RUN_PERF=1)");

const results: Record<string, unknown> = {};

async function trackRequests(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/")) calls.push(`${r.method()} ${r.url().replace(/^https?:\/\/[^/]+/, "").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")}`);
  });
  return calls;
}

const duplicates = (calls: string[]) => {
  const count = new Map<string, number>();
  for (const c of calls) count.set(c, (count.get(c) ?? 0) + 1);
  return [...count].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`);
};

async function longTasks(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __lt: number[] }).__lt = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { __lt: number[] }).__lt.push(e.duration);
    }).observe({ entryTypes: ["longtask"] });
  });
  return async () => {
    const lt = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt.splice(0));
    return { count: lt.length, totalMs: Math.round(lt.reduce((a, b) => a + b, 0)), maxMs: Math.round(Math.max(0, ...lt)) };
  };
}

test("Pipeline (150 leads), painel, Configurações e importação de 10.000 linhas", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const tenant = tenantOf(testInfo, 196);
  const api = await Api.login(tenant);
  const stages = (await api.defaultPipeline()).stages;
  for (const [si, base] of [[0, 0], [1, 60]] as const) {
    await api.seed(
      Array.from({ length: 60 }, (_, i) => ({ name: `Perf ${si}-${String(i).padStart(3, "0")}`, phone: phoneOf(66 + si, base + i) })),
      stages[si]!.id,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const takeLong = await longTasks(page);
  const calls = await trackRequests(page);
  await loginUi(page, tenant);
  calls.length = 0;
  await takeLong();

  // 1) Pipeline: da navegação até o quadro pronto
  const t0 = Date.now();
  await openPipeline(page);
  await expect(page.getByRole("button", { name: /^Abrir / }).first()).toBeVisible();
  results.pipelineLoad = { ms: Date.now() - t0, apiCalls: calls.length, duplicates: duplicates(calls), longTasks: await takeLong() };

  // 2) abrir o painel (10 vezes): clique → conteúdo da timeline visível
  const opens: number[] = [];
  for (let i = 0; i < 10; i++) {
    calls.length = 0;
    // abre os 10 primeiros cartões da coluna Novo (a ordem do quadro é a do servidor)
    const card = page.getByRole("button", { name: /^Abrir Perf 0-/ }).nth(i);
    const lead = ((await card.getAttribute("aria-label")) ?? "").replace(/^Abrir /, "");
    const s = Date.now();
    await card.click({ timeout: 15_000 });
    const dialog = page.getByRole("dialog", { name: `Lead ${lead}` });
    await expect(dialog.getByText("Lead criado")).toBeVisible();
    opens.push(Date.now() - s);
    if (i === 0) results.drawerApiCalls = { calls: [...calls], duplicates: duplicates(calls) };
    await dialog.getByRole("button", { name: "Fechar lead" }).click();
  }
  results.drawerOpenMs = { runs: opens, median: [...opens].sort((a, b) => a - b)[5] };
  results.drawerLongTasks = await takeLong();

  // 3) Configurações: carga e troca de categoria
  calls.length = 0;
  const c0 = Date.now();
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { name: "Pipelines e etapas" })).toBeVisible();
  results.settingsLoad = { ms: Date.now() - c0, apiCalls: calls.length, duplicates: duplicates(calls), calls: [...calls] };
  const n0 = Date.now();
  await page.getByRole("button", { name: /Mensagens de WhatsApp/ }).click();
  await expect(page.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeVisible();
  results.settingsSwitchMs = Date.now() - n0;

  // 4) importação: 10.000 linhas só no navegador (leitura, mapeamento, revisão) — sem enviar
  await openPipeline(page);
  await openImport(page);
  await takeLong();
  const f0 = Date.now();
  await importDialog(page).getByLabel("Arquivo CSV com os leads").setInputFiles(file(validCsv(10_000, 67)));
  await expect(importDialog(page).getByText(/10000 linha[(]s[)] encontrada/)).toBeVisible({ timeout: 60_000 });
  const parseMs = Date.now() - f0;
  const r0 = Date.now();
  await importDialog(page).getByRole("button", { name: "Continuar" }).click();
  await expect(importDialog(page).getByRole("region", { name: "Pré-importação" })).toBeVisible();
  results.csv10k = { readAndParseMs: parseMs, reviewMs: Date.now() - r0, longTasks: await takeLong() };

  mkdirSync("e2e/.artifacts", { recursive: true });
  writeFileSync("e2e/.artifacts/perf-measure.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
});
