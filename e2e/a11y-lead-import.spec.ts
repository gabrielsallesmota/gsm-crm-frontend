// Acessibilidade REAL (axe-core, WCAG 2.2 AA) do painel do lead e das 5 etapas do assistente de CSV
// (Prompt 07), em 4 resoluções × 2 temas, sem rolagem horizontal. Dados FICTÍCIOS. Tenants 131–146
// (só Chromium). Leitor de tela (NVDA/VoiceOver): NÃO executado aqui.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import { importButton, importDialog, loginUi, openImport, openPipeline, stateText } from "./support/app";
import { file, toCsv } from "./support/csv";
import { tenantOf } from "./support/env";

mkdirSync("e2e/.artifacts", { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "notebook-1366x768", width: 1366, height: 768 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;

const STRICT_RULES = [
  "button-name", "select-name", "label", "aria-dialog-name", "aria-valid-attr", "aria-valid-attr-value",
  "aria-required-attr", "aria-allowed-attr", "nested-interactive", "duplicate-id-aria", "aria-hidden-focus",
  "color-contrast", "list", "listitem", "aria-required-children", "aria-required-parent", "scrollable-region-focusable",
];

async function audit(page: Page, name: string, scope: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .include(scope)
    .analyze();
  writeFileSync(
    `e2e/.artifacts/axe-${name}.json`,
    JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target })), null, 2),
  );
  const strict = violations.filter((v) => STRICT_RULES.includes(v.id) || v.impact === "critical");
  expect(strict.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), `axe (${name})`).toEqual([]);
}

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

const setTheme = (page: Page, theme: (typeof THEMES)[number]) =>
  page.addInitScript((t) => localStorage.setItem("gsm_theme", t), theme);

for (const [ti, theme] of THEMES.entries()) {
  for (const [vi, vp] of VIEWPORTS.entries()) {
    test.describe(`${vp.name} · tema ${theme}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("Painel do lead: leitura e edição (axe, sem rolagem horizontal)", async ({ page }, testInfo) => {
        const tenant = tenantOf(testInfo, 131 + ti * 4 + vi);
        const api = await Api.login(tenant);
        const [novo] = (await api.defaultPipeline()).stages;
        const lead = await api.createLead({
          name: "Cliente Acessível", stageId: novo!.id, ownerId: (await api.me()).id, company: "Empresa Exemplo",
          phone: phoneOf(72, 1), email: "cliente@example.com", value: 2500,
        });
        for (let i = 1; i <= 3; i++) await api.comment(lead.id, `Comentário de exemplo ${i}`);
        await setTheme(page, theme);
        await loginUi(page, tenant);
        await openPipeline(page);
        await page.getByRole("button", { name: "Abrir Cliente Acessível" }).click();
        const d = page.getByRole("dialog", { name: "Lead Cliente Acessível" });
        await expect(d.getByText("Comentário de exemplo 3")).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `drawer-${vp.name}-${theme}`, "[role=dialog]");
        await d.getByRole("button", { name: /Editar/ }).click();
        await d.getByLabel("E-mail", { exact: true }).fill("invalido");
        await d.getByLabel("Empresa").focus(); // dispara a validação (erro ao lado do campo)
        await expect(d.getByText(/Informe um e-mail válido/)).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `drawer-edicao-${vp.name}-${theme}`, "[role=dialog]");
      });

      test("Assistente de CSV: as 5 etapas (axe, diálogo contido na tela)", async ({ page }, testInfo) => {
        const tenant = tenantOf(testInfo, 139 + ti * 4 + vi);
        await setTheme(page, theme);
        await loginUi(page, tenant);
        await openPipeline(page);
        await openImport(page);
        const dialog = importDialog(page);
        await audit(page, `csv-arquivo-${vp.name}-${theme}`, "[role=dialog]");
        const rows = [["Nome", "Telefone", "Coluna Extra"]];
        for (let i = 0; i < 6; i++) rows.push([`Pessoa ${i}`, phoneOf(73, i), "x"]);
        await dialog.getByLabel("Arquivo CSV com os leads").setInputFiles(file(toCsv(rows)));
        await expect(dialog.getByText(/6 linha[(]s[)] encontrada/)).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `csv-colunas-${vp.name}-${theme}`, "[role=dialog]");
        await dialog.getByRole("button", { name: "Continuar" }).click();
        await expect(dialog.getByRole("region", { name: "Pré-importação" })).toBeVisible();
        await audit(page, `csv-revisao-${vp.name}-${theme}`, "[role=dialog]");
        await importButton(page).click();
        await expect(stateText(page, "Concluído")).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `csv-resultado-${vp.name}-${theme}`, "[role=dialog]");
        const box = (await dialog.boundingBox())!;
        expect(box.width).toBeLessThanOrEqual(vp.width);
        expect(box.height).toBeLessThanOrEqual(vp.height + 1);
      });
    });
  }
}
