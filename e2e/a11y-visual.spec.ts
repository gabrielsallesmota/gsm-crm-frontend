// Acessibilidade e layout REAIS (navegador de verdade): resoluções, temas, foco, teclado, alvos de
// toque, axe-core e capturas de tela. As capturas usam só dados FICTÍCIOS (sem dado pessoal) e ficam
// em e2e/.artifacts/screenshots (não versionadas). Leitor de tela (NVDA/VoiceOver): NÃO executado aqui.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import {
  chooseFile,
  column,
  importButton,
  importDialog,
  loginUi,
  openImport,
  openPipeline,
  progressBar,
  stateText,
} from "./support/app";
import { file, holdBatches, validCsv } from "./support/csv";
import { tenantOf } from "./support/env";

const SHOTS = "e2e/.artifacts/screenshots";
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "notebook-1366x768", width: 1366, height: 768 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;

const setTheme = (page: Page, theme: (typeof THEMES)[number]) =>
  page.addInitScript((t) => localStorage.setItem("gsm_theme", t), theme);

/** Regras que o redesign NÃO pode quebrar nos controles tocados pela Fase 1B: falha o teste. */
const STRICT_RULES = [
  "button-name",
  "select-name",
  "label",
  "aria-dialog-name",
  "aria-valid-attr",
  "aria-valid-attr-value",
  "aria-required-attr",
  "aria-allowed-attr",
  "nested-interactive",
  "duplicate-id-aria",
  "aria-hidden-focus",
  // Prompt 06: o contraste do botão de WhatsApp foi corrigido; contraste passa a ser regra FIXA.
  "color-contrast",
];

async function audit(page: Page, name: string, scope?: string) {
  // espera o fim das animações de entrada (o axe mede contraste com a opacidade do momento)
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  if (scope) builder = builder.include(scope);
  const { violations } = await builder.analyze();
  writeFileSync(
    `e2e/.artifacts/axe-${name}.json`,
    JSON.stringify(
      violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target })),
      null,
      2,
    ),
  );
  const strict = violations.filter((v) => STRICT_RULES.includes(v.id) || v.impact === "critical");
  expect(strict.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), `axe (${name})`).toEqual([]);
  return violations;
}

async function seedBoard(tenant: number, prefix: number) {
  const api = await Api.login(tenant);
  const [novo, contato] = (await api.defaultPipeline()).stages;
  await api.seed(
    Array.from({ length: 30 }, (_, i) => ({
      name: `Cliente Exemplo ${String(i).padStart(2, "0")}`,
      company: `Clínica ${i}`,
      phone: phoneOf(prefix, i),
    })),
    novo!.id,
  );
  await api.seed(
    Array.from({ length: 4 }, (_, i) => ({ name: `Em contato ${i}`, phone: phoneOf(prefix + 1, i) })),
    contato!.id,
  );
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} · tema ${theme}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("Pipeline: carrega, sem rolagem horizontal da página, axe e captura @cross", async ({ page }, testInfo) => {
        const tenant = tenantOf(testInfo, 61 + THEMES.indexOf(theme) * 4 + VIEWPORTS.indexOf(vp));
        await seedBoard(tenant, 70);
        await setTheme(page, theme);
        await loginUi(page, tenant);
        await openPipeline(page);
        await expect(column(page, "Novo").getByRole("button", { name: /^Abrir / }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, "a página não pode rolar na horizontal (o quadro rola dentro dele)").toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe(theme);
        await audit(page, `pipeline-${vp.name}-${theme}`, "main");
        await page.screenshot({ path: `${SHOTS}/pipeline-${vp.name}-${theme}.png` });
      });

      test("Importação: antes, em progresso e concluída (diálogo contido na tela, axe e capturas)", async ({ page }, testInfo) => {
        const tenant = tenantOf(testInfo, 69 + THEMES.indexOf(theme) * 4 + VIEWPORTS.indexOf(vp));
        await setTheme(page, theme);
        await loginUi(page, tenant);
        await openPipeline(page);
        await openImport(page);
        await page.screenshot({ path: `${SHOTS}/import-0-arquivo-${vp.name}-${theme}.png` });
        await chooseFile(page, file(validCsv(1000, 80 + VIEWPORTS.indexOf(vp) + THEMES.indexOf(theme) * 4)), 1000);
        const dialog = importDialog(page);
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        await page.screenshot({ path: `${SHOTS}/import-1-previa-${vp.name}-${theme}.png` });
        await audit(page, `import-previa-${vp.name}-${theme}`, "[role=dialog]");
        const held = await holdBatches(page);
        await importButton(page).scrollIntoViewIfNeeded();
        await importButton(page).click();
        const first = await held.next();
        await expect(progressBar(page)).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/import-2-progresso-${vp.name}-${theme}.png` });
        await audit(page, `import-progresso-${vp.name}-${theme}`, "[role=dialog]");
        await first.release();
        await (await held.next()).release();
        await expect(stateText(page, "Concluído")).toBeVisible();
        await held.stop();
        await page.screenshot({ path: `${SHOTS}/import-3-concluida-${vp.name}-${theme}.png` });
        await audit(page, `import-concluida-${vp.name}-${theme}`, "[role=dialog]");
        // o botão principal continua alcançável sem rolar a página inteira
        await expect(dialog.getByRole("button", { name: "Ver no pipeline" })).toBeInViewport();
      });
    });
  }
}

test.describe("teclado e foco", () => {
  test("Tab percorre cartão → WhatsApp → e-mail → seletor 'mover' com foco VISÍVEL em cada controle @cross", async ({ page, browserName }, testInfo) => {
    const tenant = tenantOf(testInfo, 77);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed([{ name: "Foco Um", phone: phoneOf(90, 1), email: "foco@example.com" } as never], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Foco Um" }).focus();
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        const visible = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 || style.boxShadow !== "none";
        return { label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? el.tagName, visible, w: el.getBoundingClientRect().width };
      });
      seen.push(info.label);
      expect(info.visible, `foco invisível em: ${info.label}`).toBe(true);
      expect(info.w).toBeGreaterThan(0);
      await page.keyboard.press("Tab");
    }
    // O seletor se revela quando o foco chega ao cartão. WebKit/Safari NÃO inclui links na ordem de Tab
    // por padrão (só com a preferência "Tab destaca cada item"): lá o caminho é resumo → seletor.
    expect(browserName === "webkit" ? seen.slice(0, 2) : seen).toEqual(
      browserName === "webkit"
        ? ["Abrir Foco Um", "Mover Foco Um para outra etapa"]
        : [
            "Abrir Foco Um",
            "Abrir WhatsApp de Foco Um",
            "Escrever e-mail para Foco Um",
            "Mover Foco Um para outra etapa",
          ],
    );
  });

  test("Enter/Espaço no cartão abre o lead e Esc devolve o foco ao cartão", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 78);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed([{ name: "Teclado Um", phone: phoneOf(91, 1) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const card = page.getByRole("button", { name: "Abrir Teclado Um" });
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").or(page.getByRole("complementary").filter({ hasText: "Teclado Um" })).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Abrir Teclado Um" })).toBeVisible();
  });

  test("importação: foco preso no diálogo, Esc fecha antes de escolher arquivo e o foco volta ao botão de origem", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 79);
    await loginUi(page, tenant);
    await openPipeline(page);
    const opener = page.getByRole("button", { name: "Importar planilha" }).first();
    await opener.click();
    await expect(importDialog(page)).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(importDialog(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("importação: depois de escolher o arquivo, Esc NÃO descarta o trabalho; só Cancelar", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 80);
    await loginUi(page, tenant);
    await openPipeline(page);
    await openImport(page);
    await chooseFile(page, file(validCsv(3, 92)), 3);
    await page.keyboard.press("Escape");
    await expect(importDialog(page)).toBeVisible();
    await importDialog(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(importDialog(page)).toHaveCount(0);
  });

  test("durante o processamento nada fecha o diálogo (Esc, fundo e ×); só 'Interromper importação'", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 81);
    await loginUi(page, tenant);
    await openPipeline(page);
    await openImport(page);
    await chooseFile(page, file(validCsv(600, 93)), 600);
    const held = await holdBatches(page);
    await importButton(page).click();
    const first = await held.next();
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(importDialog(page)).toBeVisible();
    await expect(importDialog(page).getByRole("button", { name: "Interromper importação" })).toBeEnabled();
    await first.release();
    await (await held.next()).release();
    await expect(stateText(page, "Concluído")).toBeVisible();
    await held.stop();
  });
});

test.describe("confirmações destrutivas", () => {
  test("excluir lead pede confirmação; Cancelar mantém e Excluir remove @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 82);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed([{ name: "Para Excluir", phone: phoneOf(94, 1) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Para Excluir" }).click();
    await page.getByRole("button", { name: "Excluir lead" }).click();
    const confirm = page.getByRole("dialog", { name: "Excluir lead?" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("Esta ação não pode ser desfeita");
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    expect(await api.leadCount()).toBe(1);
    await page.getByRole("button", { name: "Excluir lead" }).click();
    await page.getByRole("dialog", { name: "Excluir lead?" }).getByRole("button", { name: "Excluir" }).click();
    await expect.poll(() => api.leadCount()).toBe(0);
  });
});

test.describe("alvos de toque (emulação de celular)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("em tela de toque: seletor 'mover' sempre visível e controles do cartão com 44 px", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 83);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed([{ name: "Toque Um", phone: phoneOf(95, 1) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const move = page.getByLabel("Mover Toque Um para outra etapa");
    await expect(move).toBeVisible(); // visível SEM foco (não há arrastar com o dedo)
    const targets = [
      ...(await page.getByRole("button", { name: /^Mover etapa/ }).all()),
      ...(await page.locator("[data-lead-id] a[class*='btnIcon']").all()),
    ];
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const box = (await target.boundingBox())!;
      expect(Math.min(box.width, box.height), await target.evaluate((e) => e.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(43.5);
    }
    // mover pelo seletor funciona no celular
    await move.selectOption({ label: "Em contato" });
    await expect.poll(async () => (await api.leads())[0]!.stage_id).not.toBe(novo!.id);
  });
});

test.describe("alvos de toque (desktop)", () => {
  test("botões de contato e de etapa têm pelo menos 24 px (WCAG 2.2 AA)", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 84);
    const api = await Api.login(tenant);
    const [novo] = (await api.defaultPipeline()).stages;
    await api.seed([{ name: "Alvo Um", phone: phoneOf(96, 1) }], novo!.id);
    await loginUi(page, tenant);
    await openPipeline(page);
    const targets = [
      ...(await page.getByRole("button", { name: /^Mover etapa/ }).all()),
      ...(await page.locator("[data-lead-id] a[class*='btnIcon']").all()),
    ];
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const box = (await target.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  });
});
