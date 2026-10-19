// Financeiro V2 / E7 — relatórios, painel consolidado (perfis lado a lado) e fechamento mensal.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/FinanceService", () => ({
  financeService: {
    listProfiles: vi.fn(),
    overview: vi.fn(),
    dashboard: vi.fn(),
    listEntries: vi.fn(),
    listCategories: vi.fn(),
    listAccounts: vi.fn(),
    listCards: vi.fn(),
    report: vi.fn(),
    listPeriods: vi.fn(),
    closePeriod: vi.fn(),
    reopenPeriod: vi.fn(),
    reauth: vi.fn(),
  },
}));

import { FinancePage } from "../../src/pages/FinancePage";
import { financeService } from "../../src/services/FinanceService";
import type { FinanceDashboard, FinProfile } from "../../src/types/finance";
import type { FinanceOverview, PeriodState } from "../../src/types/financeReports";
import { currentMonth, shiftMonth } from "../../src/utils/finance";
import { STAFF, renderApp } from "./support/harness";

const api = vi.mocked(financeService);
afterEach(cleanup);

const PROFILES: FinProfile[] = [
  { id: "p-pf", name: "Pessoa Física", kind: "pf", archived: false, taxProvisionBps: null },
  { id: "p-pj", name: "Empresa", kind: "pj", archived: false, taxProvisionBps: 600 },
];

const OVERVIEW: FinanceOverview = {
  consolidated: true,
  profiles: [
    { profileId: "p-pf", name: "Pessoa Física", kind: "pf", incomeCents: 300_000, expenseCents: 200_000, resultCents: 100_000, liquidCents: 500_000, cardDebtCents: 0 },
    { profileId: "p-pj", name: "Empresa", kind: "pj", incomeCents: 1_000_000, expenseCents: 20_000, resultCents: 980_000, liquidCents: 2_000_000, cardDebtCents: 50_000 },
  ],
  positions: { liquidCents: 2_500_000, cardDebtCents: 50_000, netCents: 2_450_000 },
};

const DASHBOARD: FinanceDashboard = {
  month: "2031-03",
  scope: "all",
  kpis: {
    income: 1_300_000,
    expense: 220_000,
    result: 1_080_000,
    incomePaid: 0,
    incomePending: 1_300_000,
    expensePaid: 0,
    expensePending: 220_000,
    savingsRate: 0.8,
    previous: { income: 0, expense: 0, result: 0 },
  },
  byScope: {
    pf: { income: 300_000, expense: 200_000, result: 100_000 },
    pj: { income: 1_000_000, expense: 20_000, result: 980_000 },
  },
  series: [],
  categories: { expense: [], income: [] },
  pending: {
    payableOverdue: { total: 0, count: 0 },
    payableSoon: { total: 0, count: 0 },
    receivableOverdue: { total: 0, count: 0 },
    receivableSoon: { total: 0, count: 0 },
    upcoming: [],
  },
  topExpenses: [],
  daily: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listProfiles.mockResolvedValue(PROFILES);
  api.overview.mockResolvedValue(OVERVIEW);
  api.dashboard.mockResolvedValue(DASHBOARD);
  api.listCategories.mockResolvedValue([]);
  api.listAccounts.mockResolvedValue([]);
  api.listCards.mockResolvedValue([]);
  api.listEntries.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  api.listPeriods.mockResolvedValue([]);
  api.report.mockResolvedValue({
    rows: [{ month: "2031-03", inflowCents: 300_000, outflowCents: 100_000, netCents: 200_000 }],
  });
});

const open = (route: string) => renderApp(<FinancePage />, { user: STAFF, route });

describe("Painel consolidado", () => {
  it("mostra os perfis lado a lado e as posições, sem juntar o lucro da PJ com a sobra da PF", async () => {
    open("/financeiro");
    const panel = await screen.findByRole("region", { name: "Perfis e posições" });
    expect(within(panel).getByText(/Consolidado: perfis lado a lado/)).toBeTruthy();
    expect(within(panel).getByText(/posição líquida R\$\s24\.500,00/)).toBeTruthy();
    const table = within(panel).getByRole("table");
    expect(within(table).getByText("Empresa")).toBeTruthy();
    expect(within(table).getByText(/R\$\s9\.800,00/)).toBeTruthy(); // resultado da PJ
    expect(within(table).getByText(/R\$\s1\.000,00/)).toBeTruthy(); // sobra da PF (separada)
    expect(within(panel).getByText(/não se somam/)).toBeTruthy();
  });

  it("escolhendo um perfil, pede o painel e a visão só desse perfil", async () => {
    open("/financeiro");
    await screen.findByRole("region", { name: "Perfis e posições" });
    api.overview.mockResolvedValue({ ...OVERVIEW, consolidated: false, profiles: [OVERVIEW.profiles[1]!] });
    fireEvent.click(screen.getByRole("button", { name: "Empresa" }));
    await waitFor(() => expect(api.overview).toHaveBeenLastCalledWith(expect.any(String), "p-pj"));
    expect(await screen.findByText("Posição do perfil")).toBeTruthy();
  });
});

describe("Relatórios", () => {
  it("abre no fluxo de caixa dos últimos 12 meses", async () => {
    open("/financeiro?aba=relatorios");
    const table = await screen.findByRole("table", { name: "Fluxo de caixa por mês" });
    expect(within(table).getByText(/R\$\s3\.000,00/)).toBeTruthy();
    expect(api.report).toHaveBeenCalledWith("cash-flow", { months: 12 });
  });

  it("troca de relatório e envia os parâmetros certos", async () => {
    api.report.mockImplementation(async (kind: string) => {
      if (kind === "by-category") {
        return { totalCents: 120_000, rows: [{ categoryId: "c1", name: "Moradia", color: "#fff", totalCents: 90_000, count: 1, share: 0.75 }] };
      }
      return { rows: [] };
    });
    open("/financeiro?aba=relatorios");
    await screen.findByRole("table", { name: "Fluxo de caixa por mês" });
    fireEvent.change(screen.getByLabelText("Relatório"), { target: { value: "by-category" } });
    expect(await screen.findByRole("table", { name: "Por categoria" })).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    const params = api.report.mock.calls.at(-1)![1] as Record<string, string>;
    expect(params["date_from"]).toMatch(/^\d{4}-\d{2}-01$/);
    expect(params["date_to"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("resultado gerencial PJ mostra o aviso de que não é apuração fiscal e a conta", async () => {
    api.report.mockImplementation(async (kind: string) => {
      if (kind !== "pj-management") return { rows: [] };
      return {
        managerial: true,
        disclaimer: "Relatório gerencial: não substitui a apuração fiscal nem contábil oficial.",
        incomeCents: 1_000_000,
        taxProvisionBps: 600,
        taxProvisionCents: 60_000,
        netRevenueCents: 940_000,
        costs: { fixed: 100_000, variable: 50_000, unclassified: 20_000 },
        totalCostsCents: 170_000,
        proLaboreCents: 200_000,
        operatingResultCents: 570_000,
        margin: 0.57,
        profitDistributionCents: 300_000,
        byClient: [{ name: "Aurora", incomeCents: 700_000, expenseCents: 0, resultCents: 700_000 }],
        byProject: [],
      };
    });
    open("/financeiro?aba=relatorios");
    await screen.findByRole("table", { name: "Fluxo de caixa por mês" });
    fireEvent.change(screen.getByLabelText("Relatório"), { target: { value: "pj-management" } });
    expect(await screen.findByRole("note")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/não substitui a apuração fiscal/);
    const table = screen.getByRole("table", { name: "Resultado gerencial" });
    expect(within(table).getByText("Resultado operacional gerencial")).toBeTruthy();
    expect(within(table).getByText(/R\$\s5\.700,00/)).toBeTruthy();
    expect(screen.getByText(/57,0%/)).toBeTruthy();
    expect(screen.getByText(/não é custo/)).toBeTruthy();
    expect(api.report.mock.calls.at(-1)![1]).toMatchObject({ profile_id: "p-pj" });
  });
});

describe("Fechamento mensal", () => {
  const last = shiftMonth(currentMonth(), -1);

  it("lista os últimos 12 meses e fecha um mês", async () => {
    api.closePeriod.mockResolvedValue();
    open("/financeiro?aba=relatorios");
    const list = await screen.findByRole("list", { name: "Meses" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
    fireEvent.click(within(list).getAllByRole("button", { name: /^Fechar / })[0]!);
    await waitFor(() => expect(api.closePeriod).toHaveBeenCalledWith("p-pf", last));
  });

  it("reabrir pede motivo e senha, e manda o token de reautenticação", async () => {
    const closed: PeriodState = { profileId: "p-pf", month: `${last}-01`, closed: true, closedAt: "2031-03-02T00:00:00Z", reopenedAt: null, reopenReason: null };
    api.listPeriods.mockResolvedValue([closed]);
    api.reauth.mockResolvedValue("tok123");
    api.reopenPeriod.mockResolvedValue();
    open("/financeiro?aba=relatorios");
    const list = await screen.findByRole("list", { name: "Meses" });
    fireEvent.click(await within(list).findByRole("button", { name: /^Reabrir / }));
    const dialog = await screen.findByRole("dialog", { name: "Reabrir o mês?" });
    const confirm = within(dialog).getByRole("button", { name: "Reabrir" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // sem motivo e senha não dá
    fireEvent.change(within(dialog).getByLabelText("Motivo"), { target: { value: "Corrigir valor" } });
    fireEvent.change(within(dialog).getByLabelText("Senha"), { target: { value: "segredo" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.reauth).toHaveBeenCalledWith("segredo"));
    await waitFor(() =>
      expect(api.reopenPeriod).toHaveBeenCalledWith("p-pf", last, "Corrigir valor", "tok123"),
    );
  });
});
