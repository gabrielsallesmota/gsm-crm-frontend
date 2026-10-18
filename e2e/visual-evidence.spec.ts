// Evidências VISUAIS do redesign do Pipeline (Prompt 06): capturas REAIS do app em execução, contra a
// API isolada, com dados FICTÍCIOS (sem dado pessoal). Saída: docs/ux-redesign/fase-2-design-system-pipeline/evidencias/.
// As capturas documentam o estado; quem garante o comportamento são os testes funcionais.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import { column, loginUi, openPipeline, waitBoardIdle } from "./support/app";
import { tenantOf } from "./support/env";

const OUT = "docs/ux-redesign/fase-2-design-system-pipeline/evidencias";
mkdirSync(OUT, { recursive: true });

const NAMES = [
  "Mariana Albuquerque", "Rafael Tavares", "Beatriz Nogueira", "Carlos Eduardo Menezes", "Fernanda Lacerda",
  "Thiago Barbosa", "Juliana Prado", "Ricardo Amaral", "Patrícia Lima", "Bruno Teixeira", "Larissa Gomes",
  "André Cordeiro", "Camila Duarte", "Eduardo Faria", "Helena Rocha", "Gustavo Pires", "Aline Cavalcante",
  "Marcelo Antunes", "Renata Bastos", "Felipe Moura", "Débora Salgado", "Vinícius Araújo", "Letícia Fontes", "Otávio Brandão",
];
const COMPANIES = [
  "Clínica Vitalis", "Odonto Sorriso", "Studio Bem-Estar", "Escritório Lacerda & Filhos", "Pet Care Vila Nova",
  "Academia Movimento", "Contábil Prado", "Imobiliária Horizonte",
];
const ORIGINS = ["whatsapp", "instagram", "landing_page", "google", "facebook", "manual"];

/** Quadro realista: 4 etapas, valores, responsáveis diferentes e alguns comentários. */
async function seedRealistic(tenant: number) {
  const admin = await Api.login(tenant, "admin");
  const gestor = await Api.login(tenant, "gestor");
  const vendedor = await Api.login(tenant, "vendedor");
  const owners = [(await admin.me()).id, (await gestor.me()).id, (await vendedor.me()).id];
  const stages = (await admin.defaultPipeline()).stages;
  const plan: [number, number, number][] = [
    [0, 0, 11],
    [1, 11, 8],
    [2, 19, 3],
    [3, 22, 2],
  ];
  let n = 0;
  for (const [stageIndex, from, count] of plan) {
    for (let i = 0; i < count; i++) {
      const idx = from + i;
      const lead = await admin.createLead({
        name: NAMES[idx % NAMES.length]!,
        stageId: stages[stageIndex]!.id,
        ownerId: owners[idx % owners.length]!,
        company: COMPANIES[idx % COMPANIES.length]!,
        phone: phoneOf(97, idx),
        email: idx % 3 === 0 ? `contato${idx}@example.com` : undefined,
        value: idx % 4 === 0 ? undefined : (idx % 6 + 1) * 1200,
        origin: ORIGINS[idx % ORIGINS.length]!,
      });
      if (idx % 5 === 0) await admin.comment(lead.id, "Pediu retorno na sexta para fechar a proposta");
      n++;
    }
  }
  return { n, stages };
}

async function shot(page: Page, name: string, clip?: Parameters<Page["screenshot"]>[0]) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ?? {}) });
}

const setTheme = (page: Page, theme: "light" | "dark") =>
  page.addInitScript((t) => localStorage.setItem("gsm_theme", t), theme);

const VIEWS = [
  { slug: "desktop-1920", width: 1920, height: 1080 },
  { slug: "notebook-1366", width: 1366, height: 768 },
  { slug: "tablet-768", width: 768, height: 1024 },
  { slug: "mobile-390", width: 390, height: 844 },
] as const;

for (const [vi, view] of VIEWS.entries()) {
  for (const [ti, theme] of (["light", "dark"] as const).entries()) {
    test(`Pipeline ${view.slug} · ${theme}`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const tenant = tenantOf(testInfo, 101 + vi * 2 + ti);
      await seedRealistic(tenant);
      await page.setViewportSize({ width: view.width, height: view.height });
      await setTheme(page, theme);
      await loginUi(page, tenant);
      await openPipeline(page);
      await expect(page.getByRole("button", { name: /^Abrir / }).first()).toBeVisible();
      await shot(page, `pipeline-${view.slug}-${theme === "light" ? "claro" : "escuro"}`);
    });
  }
}

test("Estados do cartão e da coluna (hover, foco, vazio, carregando, erro, arraste, filtros)", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const tenant = tenantOf(testInfo, 109);
  const { stages } = await seedRealistic(tenant);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, tenant);
  await openPipeline(page);

  // hover
  const card = page.locator("[data-lead-id]").first();
  await card.hover();
  await shot(page, "card-hover", { clip: (await card.boundingBox())! });

  // foco por teclado: o cartão ganha borda e o seletor "mover" aparece
  await card.getByRole("button").first().focus();
  await page.keyboard.press("Tab");
  await shot(page, "card-foco-teclado", { clip: (await card.boundingBox())! });

  // coluna vazia (outro quadro sem leads na etapa Perdido): filtra por um termo sem resultado em UMA etapa
  await expect(column(page, "Perdido")).toBeVisible();

  // filtros abertos + chips
  await page.getByLabel("Buscar lead", { exact: true }).fill("a");
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.getByRole("button", { name: "Tudo" }).click();
  await page.getByLabel("Responsável").selectOption({ label: "Gestor t109" });
  await page.getByLabel("Ordenação").selectOption("az");
  await expect(page.getByRole("group", { name: "Filtros ativos" })).toBeVisible();
  await waitBoardIdle(page);
  await shot(page, "filtros-abertos-com-chips");

  // arraste em andamento (HTML5: mouse down + move deixa o estado "arrastando" ativo)
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByRole("button", { name: /^Filtros/ }).click(); // fecha o painel
  await waitBoardIdle(page);
  const source = page.locator("[data-lead-id]").first();
  const target = column(page, "Em contato");
  // Eventos de arraste sintéticos (o arraste nativo não aparece em capturas): deixam a tela no estado
  // "arrastando" — cartão de origem esmaecido e coluna de destino realçada com "Soltar aqui".
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer: transfer });
  await target.dispatchEvent("dragenter", { dataTransfer: transfer });
  await target.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(page.getByText("Soltar aqui")).toBeVisible();
  await shot(page, "arrastando-card");
  await source.dispatchEvent("dragend", { dataTransfer: transfer });

  // coluna com erro
  await page.route(/stage_id=[^&]*&?/, (route) =>
    route.request().url().includes(stages[3]!.id)
      ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
      : route.continue(),
  );
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: /carregar|inesperado/i }).first()).toBeVisible();
  await shot(page, "coluna-com-erro");
  await page.unroute(/stage_id=[^&]*&?/);

  // carregando: respostas seguradas (esqueletos nas colunas)
  await page.route(/\/api\/v1\/leads\?/, async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    await route.continue();
  });
  await page.reload();
  await expect(page.getByText("Carregando…").first()).toBeAttached();
  await page.waitForTimeout(700);
  await shot(page, "carregando-esqueletos");
});

test("Pipeline vazio e coluna vazia", async ({ page }, testInfo) => {
  const tenant = tenantOf(testInfo, 110);
  const api = await Api.login(tenant);
  const stages = (await api.defaultPipeline()).stages;
  const me = (await api.me()).id;
  await api.createLead({ name: "Único Lead de Exemplo", stageId: stages[0]!.id, ownerId: me, company: "Clínica Vitalis", value: 3600, origin: "landing_page" });
  await page.setViewportSize({ width: 1440, height: 800 });
  await loginUi(page, tenant);
  await openPipeline(page);
  await shot(page, "colunas-vazias");
});
