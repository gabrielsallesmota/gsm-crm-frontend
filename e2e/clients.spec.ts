// E2E de Clientes para todos os tenants (Fase 1) contra a API real: lead ganho → "Criar cliente?" →
// ficha com contrato, renovação e parcelas → papéis (vendedor só lê) → regra de renovação nas
// Automações → acessibilidade. Tenants 160–166 (só Chromium; ver support/env.ts).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Api, phoneOf } from "./support/api";
import { loginUi, openPipeline } from "./support/app";
import { tenantOf } from "./support/env";

const STRICT_RULES = [
  "button-name", "select-name", "label", "aria-dialog-name", "aria-valid-attr", "aria-valid-attr-value",
  "aria-required-attr", "aria-allowed-attr", "nested-interactive", "duplicate-id-aria", "aria-hidden-focus",
  "color-contrast", "list", "listitem", "aria-required-children", "aria-required-parent",
  "scrollable-region-focusable", "link-name", "heading-order", "region",
];

async function axe(page: Page, name: string, scope?: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  if (scope) builder = builder.include(scope);
  const { violations } = await builder.analyze();
  const strict = violations.filter((v) => STRICT_RULES.includes(v.id) || v.impact === "critical");
  expect(
    strict.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    `axe (${name})`,
  ).toEqual([]);
}

const noHorizontalScroll = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);

const isoDay = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function seedLead(tenant: number, name: string, company: string, value: number) {
  const api = await Api.login(tenant);
  const [novo] = (await api.defaultPipeline()).stages;
  const me = await api.me();
  const lead = await api.createLead({
    name,
    stageId: novo!.id,
    ownerId: me.id,
    company,
    phone: phoneOf(tenant, 1),
    value,
  });
  return { api, lead };
}

test.describe("Clientes — do lead ganho à renovação", () => {
  test("lead ganho vira cliente com renovação, contrato e parcelas; vendedor só consulta", async ({ page, browser }, testInfo) => {
    const tenant = tenantOf(testInfo, 160);
    const renewal = isoDay(400);
    const { api, lead } = await seedLead(tenant, "Marina Ganho", "Consórcio Horizonte", 3000);

    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Marina Ganho" }).click();
    const drawer = page.getByRole("dialog", { name: "Lead Marina Ganho" });
    await drawer.getByLabel("Etapa").selectOption({ label: "Ganho (ganho)" });

    // pergunta, não impõe: o formulário já vem com o valor do lead
    const ask = page.getByRole("dialog", { name: "Criar cliente?" });
    await expect(ask).toBeVisible();
    await expect(ask.getByLabel("Valor do contrato")).toHaveValue(/3\.000,00/);
    await axe(page, "dialogo-criar-cliente", '[role="dialog"][aria-labelledby]');
    await ask.getByLabel("Data de renovação (opcional)").fill(renewal);
    await ask.getByLabel("Aviso de renovação").selectOption("days_before");
    await ask.getByLabel("Dias de antecedência").fill("20");
    await expect(ask.getByText(/20 dias antes — a tarefa aparece em/)).toBeVisible();
    await ask.getByRole("button", { name: "Criar cliente" }).click();
    await expect(page.getByRole("heading", { name: "Cliente criado" })).toBeVisible();
    await page.getByRole("button", { name: "Abrir ficha do cliente" }).click();

    // ficha: contrato com a renovação e o aviso
    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
    const ficha = page.getByRole("dialog", { name: "Cliente Consórcio Horizonte" });
    await expect(ficha).toBeVisible();
    const contratos = ficha.getByRole("region", { name: "Contratos e renovação" });
    await expect(contratos.getByText(/20 dias antes — a tarefa aparece em/)).toBeVisible();

    // parcelas: monta o plano, edita uma parcela e marca outra como paga
    await contratos.getByRole("button", { name: "Ver parcelas" }).click();
    await contratos.getByRole("button", { name: "Definir pagamento" }).click();
    await contratos.getByLabel("Forma de pagamento").selectOption("mensal");
    await contratos.getByLabel("Valor total do contrato").fill("300000");
    await contratos.getByLabel("Quantidade de parcelas").fill("3");
    await contratos.getByLabel("Data do 1º vencimento").fill(isoDay(30));
    await contratos.getByRole("button", { name: "Gerar parcelas" }).click();
    await expect(page.getByText("Parcelas geradas com sucesso")).toBeVisible();
    await expect(contratos.getByRole("row")).toHaveCount(4); // cabeçalho + 3

    await contratos.getByRole("button", { name: "Marcar pago" }).first().click();
    await expect(contratos.getByText("Pago", { exact: true })).toBeVisible();
    await contratos.getByRole("button", { name: "Editar", exact: true }).first().click();
    await contratos.getByLabel("Valor da parcela 2").fill("150000");
    await contratos.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Parcela atualizada")).toBeVisible();
    await axe(page, "ficha-cliente", '[role="dialog"][aria-label^="Cliente "]');

    // a API confirma o que a tela mostrou
    const clients = await api.request<{ items: { id: string; source_id: string; contracts_count: number; next_renewal_date: string; total_value_cents: number }[] }>("GET", "/api/v1/clients");
    const mine = clients.body.items.find((c) => c.source_id === lead.id)!;
    expect(mine.contracts_count).toBe(1);
    expect(mine.next_renewal_date).toBe(renewal);
    const installments = await api.request<{ amount_cents: number; paid_at: string | null }[]>("GET", `/api/v1/clients/${mine.id}/installments`);
    expect(installments.body.map((i) => i.amount_cents)).toEqual([100000, 150000, 100000]);
    expect(installments.body.filter((i) => i.paid_at).length).toBe(1);

    // vendedor do MESMO tenant: vê o cliente, a renovação e as parcelas, mas nenhuma ação de dinheiro
    const context = await browser.newContext({
      baseURL: "http://localhost:5174",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    const vendedor = await context.newPage();
    await loginUi(vendedor, tenant, "vendedor");
    await vendedor.goto(`/clientes/${mine.id}`);
    const fichaV = vendedor.getByRole("dialog", { name: "Cliente Consórcio Horizonte" });
    await expect(fichaV).toBeVisible();
    await expect(fichaV.getByText("Contratos e renovação")).toBeVisible();
    await fichaV.getByRole("button", { name: "Ver parcelas" }).click();
    await expect(fichaV.getByText("Pago", { exact: true })).toBeVisible();
    for (const name of [/Novo contrato/, /Editar contrato/, /Marcar pago|Desmarcar/, /Definir pagamento|Refazer parcelas/, /Remover cliente/, /Encerrar/]) {
      await expect(fichaV.getByRole("button", { name })).toHaveCount(0);
    }
    await context.close();
  });

  test("lead que já é cliente oferece 'Ver cliente' e não duplica; 'Agora não' não cria nada", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 161);
    const { api, lead } = await seedLead(tenant, "Paulo Repetido", "Seguros Paulo", 900);
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Paulo Repetido" }).click();
    const drawer = page.getByRole("dialog", { name: "Lead Paulo Repetido" });
    await drawer.getByLabel("Etapa").selectOption({ label: "Ganho (ganho)" });

    await page.getByRole("dialog", { name: "Criar cliente?" }).getByRole("button", { name: "Agora não" }).click();
    expect((await api.request<{ total: number }>("GET", "/api/v1/clients")).body.total).toBe(0);

    // o botão do cabeçalho do lead ganho reabre a pergunta; criar → depois mostra "Ver cliente"
    await drawer.getByRole("button", { name: /Cliente$/ }).click();
    const ask = page.getByRole("dialog", { name: "Criar cliente?" });
    await ask.getByRole("button", { name: "Criar cliente" }).click();
    await expect(page.getByRole("heading", { name: "Cliente criado" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar", exact: true }).first().click();

    await drawer.getByRole("button", { name: /Cliente$/ }).click();
    await expect(page.getByRole("dialog", { name: "Este lead já é cliente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver cliente" })).toBeVisible();
    const list = await api.request<{ total: number; items: { source_id: string }[] }>("GET", "/api/v1/clients");
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]!.source_id).toBe(lead.id);
  });

  test("lista de Clientes: filtros de renovação e atraso, busca e link direto da ficha", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 162);
    const api = await Api.login(tenant);
    const mk = async (company: string, renewal: string | null) => {
      const c = await api.request<{ id: string }>("POST", "/api/v1/clients", { company_name: company });
      expect(c.status).toBe(201);
      if (renewal) {
        const k = await api.request("POST", `/api/v1/clients/${c.body.id}/contracts`, {
          start_date: "2024-01-01",
          renewal_date: renewal,
        });
        expect(k.status).toBe(201);
      }
      return c.body.id;
    };
    const soon = await mk("Renova Logo Ltda", isoDay(10));
    await mk("Renova Longe Ltda", isoDay(300));
    await mk("Sem Contrato Ltda", null);

    await loginUi(page, tenant);
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Renova Logo Ltda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Renova Longe Ltda" })).toBeVisible();

    await page.getByRole("button", { name: "Renovam em até 30 dias" }).click();
    await expect(page.getByRole("button", { name: "Renova Logo Ltda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Renova Longe Ltda" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sem Contrato Ltda" })).toHaveCount(0);
    await axe(page, "lista-clientes", "main");
    await noHorizontalScroll(page);

    await page.getByRole("button", { name: "Renovam em até 30 dias" }).click(); // desliga
    await page.getByLabel("Buscar cliente").fill("Sem Contrato");
    await expect(page.getByRole("button", { name: "Sem Contrato Ltda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Renova Logo Ltda" })).toHaveCount(0);

    // link direto da ficha, mesmo fora do filtro atual
    await page.goto(`/clientes/${soon}`);
    await expect(page.getByRole("dialog", { name: "Cliente Renova Logo Ltda" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page).toHaveURL(/\/clientes$/);
  });

  test("regra de renovação nas Automações: modo e antecedência salvos de verdade", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 163);
    const api = await Api.login(tenant);
    await loginUi(page, tenant);
    await page.goto("/configuracoes/automacoes");
    const card = page.getByRole("heading", { name: "Renovação de contrato" }).locator("xpath=ancestor::li[1]");
    await expect(card).toBeVisible();
    await expect(card.getByText("Ligada")).toBeVisible(); // nasce ligada
    await card.getByLabel("Quando avisar").selectOption({ label: "Dias antes da renovação" });
    await card.getByLabel("Antecedência").fill("12");
    await card.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(card.getByText("Regra salva.")).toBeVisible();
    await axe(page, "automacoes-renovacao", 'li[aria-labelledby="automation-renewal"]');

    const rules = await api.request<{ items: { key: string; enabled: boolean; params: Record<string, number> }[] }>("GET", "/api/v1/automations");
    const renewal = rules.body.items.find((r) => r.key === "renewal")!;
    expect(renewal.enabled).toBe(true);
    expect(renewal.params).toEqual({ alert_mode: 1, alert_value: 12 });
  });

  test("isolamento: o cliente de um tenant não aparece nem abre em outro", async ({ page }, testInfo) => {
    const mine = tenantOf(testInfo, 164);
    const other = tenantOf(testInfo, 165);
    const a = await Api.login(mine);
    const created = await a.request<{ id: string }>("POST", "/api/v1/clients", { company_name: "Só do Tenant A" });
    expect(created.status).toBe(201);

    await loginUi(page, other);
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Só do Tenant A" })).toHaveCount(0);
    await page.goto(`/clientes/${created.body.id}`);
    await expect(page.getByText("Cliente não encontrado")).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Cliente Só do Tenant A/ })).toHaveCount(0);
  });

  test("celular: lista e ficha sem rolagem horizontal", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 166);
    const api = await Api.login(tenant);
    const c = await api.request<{ id: string }>("POST", "/api/v1/clients", { company_name: "Cliente Mobile Ltda" });
    await api.request("POST", `/api/v1/clients/${c.body.id}/contracts`, {
      start_date: "2025-01-01",
      renewal_date: isoDay(40),
      value_cents: 120000,
    });
    await page.setViewportSize({ width: 375, height: 760 });
    await loginUi(page, tenant);
    await page.goto("/clientes");
    await expect(page.getByRole("button", { name: "Cliente Mobile Ltda" })).toBeVisible();
    await noHorizontalScroll(page);
    await page.goto(`/clientes/${c.body.id}`);
    await expect(page.getByRole("dialog", { name: "Cliente Cliente Mobile Ltda" })).toBeVisible();
    await noHorizontalScroll(page);
    await axe(page, "ficha-cliente-mobile", '[role="dialog"][aria-label^="Cliente "]');
  });
});
