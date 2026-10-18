// Acessibilidade REAL (axe-core, WCAG 2.2 AA) das Configurações e do diálogo de "perdido" (Prompt 08), em
// 4 resoluções × 2 temas, sem rolagem horizontal. Dados FICTÍCIOS. Tenants 171–186 (Chromium).
// Leitor de tela (NVDA/VoiceOver): NÃO executado aqui.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import { loginUi, openPipeline } from "./support/app";
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
  "color-contrast", "list", "listitem", "aria-required-children", "aria-required-parent",
  "scrollable-region-focusable", "link-name", "heading-order", "region",
];

async function audit(page: Page, name: string, scope: string) {
  // espera o fim das animações de entrada (o axe mede contraste com a opacidade do momento)
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .include(scope)
    .analyze();
  writeFileSync(
    `e2e/.artifacts/axe-${name}.json`,
    JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 12).map((n) => n.target.join(" ")), summary: v.nodes[0]?.failureSummary })), null, 2),
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

      test("Configurações: pipelines, tags, origens, templates e edição de etapa (axe, sem rolagem horizontal)", async ({ page }, testInfo) => {
        const tenant = tenantOf(testInfo, 171 + ti * 4 + vi);
        const api = await Api.login(tenant);
        await api.request("POST", "/api/v1/tags", { label: "VIP", color: "#2a9d8f", bg: "rgba(42,157,143,.14)" });
        await setTheme(page, theme);
        await loginUi(page, tenant);
        await page.goto("/configuracoes");
        await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Pipelines e etapas" })).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `config-comercial-${vp.name}-${theme}`, "main");
        // editar uma etapa abre o formulário inline (campos e rótulos)
        await page.locator("[class*='pipelineCard']").getByRole("button", { name: /^Novo/ }).first().click();
        await expect(page.getByLabel("Nome da etapa")).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `config-etapa-${vp.name}-${theme}`, "main");
        // comunicação (templates)
        if (vp.width <= 860) await page.getByLabel("Seção").selectOption({ label: "Mensagens de WhatsApp" });
        else await page.getByRole("button", { name: /Mensagens de WhatsApp/ }).click();
        await expect(page.getByRole("heading", { name: "Pipeline — mensagens de WhatsApp" })).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `config-comunicacao-${vp.name}-${theme}`, "main");
      });

      test("Confirmação de lead perdido (diálogo) e quadro (axe)", async ({ page }, testInfo) => {
        const tenant = tenantOf(testInfo, 179 + ti * 4 + vi);
        const api = await Api.login(tenant);
        const stages = (await api.defaultPipeline()).stages;
        await api.seed([{ name: "Lead Acessível", phone: phoneOf(62, 1) }], stages[0]!.id);
        await setTheme(page, theme);
        await loginUi(page, tenant);
        await openPipeline(page);
        await page.getByLabel("Mover Lead Acessível para outra etapa").selectOption({ label: "Perdido" });
        const dialog = page.getByRole("dialog", { name: "Marcar como perdido?" });
        await expect(dialog).toBeVisible();
        await noHorizontalScroll(page);
        await audit(page, `perdido-${vp.name}-${theme}`, "[role=dialog]");
        // Esc fecha o diálogo, nada é movido e o foco volta para a página
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Abrir Lead Acessível" })).toBeVisible();
      });
    });
  }
}
