// Ações de tela compartilhadas pelos E2E. Sempre aguardam estados/respostas observáveis
// (nunca `waitForTimeout` fixo).
import { expect, type Locator, type Page } from "@playwright/test";
import { email, password, type Role } from "./env";

/** Login pela tela (fluxo real). Pula o tour de boas-vindas, se aparecer. */
export async function loginUi(page: Page, tenant: number, role: Role = "admin"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email(tenant, role));
  await page.getByLabel("Senha", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function openPipeline(page: Page): Promise<void> {
  await page.goto("/pipeline");
  await expect(page.getByLabel("Ordenação")).toBeVisible();
  await waitBoardIdle(page);
}

/** Todas as colunas terminaram de carregar (nenhum "Carregando…"). */
export async function waitBoardIdle(page: Page): Promise<void> {
  await expect(page.getByText("Carregando…")).toHaveCount(0);
  // o contador da coluna fica "…" até a 1ª página chegar (também logo após trocar filtro/ordenação)
  await expect(page.locator("[data-stage-count]").filter({ hasText: "…" })).toHaveCount(0);
}

export const column = (page: Page, stage: string): Locator =>
  page.locator(`[data-stage-column][data-stage-name="${stage}"]`);

/** Nomes dos cards, na ordem em que aparecem na coluna. */
export async function cardNames(page: Page, stage: string): Promise<string[]> {
  const labels = await column(page, stage).getByRole("button", { name: /^Abrir / }).evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.replace(/^Abrir /, ""));
}

export async function columnTotal(page: Page, stage: string): Promise<number> {
  const text = await column(page, stage).locator("[data-stage-count]").textContent();
  return Number(text);
}

export async function chooseOrder(page: Page, option: "none" | "az" | "za" | "date_desc" | "date_asc"): Promise<void> {
  await page.getByLabel("Ordenação").selectOption(option);
  await waitBoardIdle(page);
}

// ---------------------------------------------------------------------------------------------
// importação CSV
// ---------------------------------------------------------------------------------------------
export const importDialog = (page: Page): Locator => page.getByRole("dialog", { name: "Importar leads via CSV" });

export async function openImport(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Importar planilha" }).first().click();
  await expect(importDialog(page)).toBeVisible();
}

/**
 * Escolhe o arquivo, espera a leitura e — se a coluna Nome foi reconhecida — avança até a revisão
 * (onde ficam as opções, a pré-importação e o botão Importar). Com Nome não reconhecido fica em
 * "Colunas" para o teste mapear.
 */
export async function chooseFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, rows: number): Promise<void> {
  await importDialog(page).getByLabel("Arquivo CSV com os leads").setInputFiles(file);
  await expect(importDialog(page).getByText(new RegExp(`${rows} linha[(]s[)] encontrada[(]s[)]`))).toBeVisible({ timeout: 60_000 });
  const next = importDialog(page).getByRole("button", { name: "Continuar" });
  if (await next.isEnabled()) {
    await next.click();
    await expect(importDialog(page).getByRole("region", { name: "Pré-importação" })).toBeVisible();
  }
}

/** Interrompe a importação em andamento (pede e confirma o diálogo). */
export async function interruptImport(page: Page): Promise<void> {
  await importDialog(page).getByRole("button", { name: "Interromper importação" }).click();
  await page.getByRole("dialog", { name: "Interromper a importação?" }).getByRole("button", { name: "Interromper" }).click();
}

export const importButton = (page: Page): Locator => importDialog(page).getByRole("button", { name: /^Importar/ });
export const stateText = (page: Page, state: string): Locator => importDialog(page).getByText(state, { exact: true });
export const progressBar = (page: Page): Locator => importDialog(page).getByRole("progressbar", { name: "Progresso da importação" });

export async function progressValue(page: Page): Promise<{ value: number; max: number }> {
  return progressBar(page).evaluate((el) => ({ value: (el as HTMLProgressElement).value, max: (el as HTMLProgressElement).max }));
}

/** Números do resumo final (Criados, Atualizados…), lidos da tela. */
export async function summaryNumbers(page: Page): Promise<Record<string, number>> {
  const pairs = await importDialog(page)
    .locator("dl")
    .first()
    .evaluate((dl) =>
      [...dl.children].map((c) => [c.querySelector("dt")?.textContent ?? "", c.querySelector("dd")?.textContent ?? ""]),
    );
  const out: Record<string, number> = {};
  for (const [label, value] of pairs) out[label!.trim()] = Number(value!.split(".").join(""));
  return out;
}
