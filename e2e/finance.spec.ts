// Financeiro V2 (E8/E9) — navegador real contra a API real do ambiente E2E isolado.
// O proprietário (fin-owner) e um outro membro da equipe (fin-staff, NÃO proprietário) são semeados por
// `scripts/e2e_backend.py` (FINANCE_OWNER_EMAILS). Só dados FICTÍCIOS. Capturas em
// e2e/.artifacts/screenshots/financeiro (não versionadas).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { API, email as tenantEmail, password } from "./support/env";

const SHOTS = "e2e/.artifacts/screenshots/financeiro";
mkdirSync(SHOTS, { recursive: true });

const OWNER = "fin-owner@example.com";
const OTHER_STAFF = "fin-staff@example.com";
const F = `${API}/api/v1/finance`;

const VIEWPORTS = [
  { name: "mobile-375x812", width: 375, height: 812 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "notebook-1366x768", width: 1366, height: 768 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
] as const;
const THEMES = ["light", "dark"] as const;
const TABS = [
  "painel",
  "lancamentos",
  "contas",
  "cartoes",
  "planejamento",
  "importar",
  "relatorios",
  "categorias",
] as const;

async function token(email: string): Promise<string> {
  const response = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: password() }),
  });
  if (!response.ok) throw new Error(`login ${email}: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function call<T>(tok: string, method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const response = await fetch(`${F}${path}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

const iso = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function loginUi(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const setTheme = (page: Page, theme: (typeof THEMES)[number]) =>
  page.addInitScript((t) => localStorage.setItem("gsm_theme", t), theme);

interface Profile { id: string; kind: "pf" | "pj" }
interface Account { id: string }

/** Dados fictícios: contas, lançamentos pagos/pendentes, cartão com compra, transferência e orçamento. */
async function seed(tok: string): Promise<void> {
  const profiles = (await call<Profile[]>(tok, "GET", "/profiles")).body;
  const pf = profiles.find((p) => p.kind === "pf")!;
  const pj = profiles.find((p) => p.kind === "pj")!;
  const acc = async (profile: Profile, name: string, extra: Record<string, unknown> = {}) =>
    (await call<Account>(tok, "POST", "/accounts", { name, profile_id: profile.id, ...extra })).body;
  const bank = await acc(pf, "Conta Corrente", { initial_balance_cents: 500_000, institution: "Banco Fictício" });
  const savings = await acc(pf, "Reserva");
  const card = await acc(pf, "Cartão Fictício", { kind: "cartao", closing_day: 25, due_day: 5, credit_limit_cents: 800_000 });
  const biz = await acc(pj, "Conta Empresa", { initial_balance_cents: 1_200_000 });
  const entry = (profile: Profile, body: Record<string, unknown>) =>
    call(tok, "POST", "/entries", { profile_id: profile.id, entry_date: iso(0), ...body });
  await entry(pf, { kind: "income", amount_cents: 650_000, description: "Salário", paid_at: iso(0), account_id: bank.id });
  await entry(pf, { kind: "expense", amount_cents: 180_000, description: "Aluguel", paid_at: iso(0), account_id: bank.id });
  await entry(pf, { kind: "expense", amount_cents: 42_000, description: "Mercado", paid_at: iso(0), account_id: bank.id, tags: ["casa"] });
  await entry(pf, { kind: "expense", amount_cents: 15_000, description: "Internet", entry_date: iso(5), account_id: bank.id });
  await entry(pf, { kind: "expense", amount_cents: 90_000, description: "Notebook", account_id: card.id });
  await entry(pj, { kind: "income", amount_cents: 2_000_000, description: "Projeto Aurora", paid_at: iso(0), account_id: biz.id, client: "Aurora", project: "Site" });
  await entry(pj, { kind: "expense", amount_cents: 120_000, description: "Software", paid_at: iso(0), account_id: biz.id });
  await call(tok, "POST", "/transfers", {
    from_account_id: bank.id,
    to_account_id: savings.id,
    amount_cents: 100_000,
    transfer_date: iso(0),
    description: "Reserva do mês",
  });
}

test.describe.configure({ mode: "serial" });

let ownerToken = "";
test.beforeAll(async () => {
  ownerToken = await token(OWNER);
  await seed(ownerToken);
});

test("acesso: só o proprietário entra; outro membro da equipe e usuário comum recebem 403", async () => {
  const staff = await token(OTHER_STAFF);
  const tenantAdmin = await token(tenantEmail(1, "admin"));
  for (const tok of [staff, tenantAdmin]) {
    for (const path of ["/profiles", "/entries", "/accounts", "/reports/overview", "/periods"]) {
      expect((await call(tok, "GET", path)).status, path).toBe(403);
    }
    expect((await call(tok, "POST", "/entries", { kind: "expense", amount_cents: 1, description: "x", entry_date: iso(0) })).status).toBe(403);
  }
  expect((await call(ownerToken, "GET", "/profiles")).status).toBe(200);
});

test("o proprietário vê o painel; o outro membro da equipe vê tela de acesso restrito", async ({ page, browser }) => {
  await loginUi(page, OWNER);
  await page.goto("/financeiro");
  await expect(page.getByRole("tab", { name: "Painel" })).toBeVisible();
  await expect(page.getByText("Não foi possível carregar o painel")).toHaveCount(0);
  const other = await browser.newPage();
  await loginUi(other, OTHER_STAFF);
  await other.goto("/financeiro");
  await expect(other.getByText("Não foi possível carregar o painel")).toBeVisible();
  await expect(other.getByText("Acesso restrito.")).toBeVisible();
  await other.close();
});

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`telas @ ${viewport.name} ${theme}: sem rolagem horizontal, capturas e axe`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await loginUi(page, OWNER);
      const runAxe = viewport.width === 390 || viewport.width === 1366;
      for (const tab of TABS) {
        await page.goto(`/financeiro?aba=${tab}`);
        await expect(page.getByText("Carregando")).toHaveCount(0);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const culprits = overflow > 1
          ? await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter((e) => {
                  if (e.getBoundingClientRect().right <= document.documentElement.clientWidth + 1) return false;
                  for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
                    if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) return false;
                  }
                  return true;
                })
                .slice(0, 5)
                .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`)
                .concat(
                  [...document.querySelectorAll("*")]
                    .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
                    .slice(0, 8)
                    .map((e) => `S:${e.tagName.toLowerCase()}.${String(e.className).slice(0, 25)}:sw${e.scrollWidth}:cw${e.clientWidth}:ox=${getComputedStyle(e).overflowX}`),
                )
                .concat(
                  [...(document.querySelector("table")?.closest("[role=tabpanel]")?.querySelectorAll("table") ?? [])].flatMap((tb) => {
                    const out: string[] = [];
                    for (let p: Element | null = tb; p && p !== document.documentElement; p = p.parentElement) {
                      out.push(`A:${p.tagName.toLowerCase()}.${String(p.className).slice(0, 25)}:w${Math.round(p.getBoundingClientRect().width)}:ox=${getComputedStyle(p).overflowX}`);
                    }
                    return out;
                  }),
                )
                .concat(
                  [...document.querySelectorAll("body *")]
                    .filter((e) => e.getBoundingClientRect().width > document.documentElement.clientWidth)
                    .slice(0, 6)
                    .map((e) => `W:${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}:${Math.round(e.getBoundingClientRect().width)}`),
                ),
            )
          : [];
        expect(overflow, `${tab}: rolagem horizontal ${culprits.join(" | ")}`).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `${SHOTS}/${tab}-${viewport.name}-${theme}.png`, fullPage: false });
        if (runAxe) {
          // o avatar do chip do tenant é do shell global (fora do escopo do financeiro)
          const { violations } = await new AxeBuilder({ page })
            .exclude('[class*="_tenantChip_"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          writeFileSync(
            `e2e/.artifacts/axe-financeiro-${tab}-${viewport.name}-${theme}.json`,
            JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target })), null, 2),
          );
          const serious = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
          expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), `axe ${tab}`).toEqual([]);
        }
      }
    });
  }
}
