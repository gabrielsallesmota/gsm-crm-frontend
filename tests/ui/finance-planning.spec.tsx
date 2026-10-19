// Financeiro V2 / E5 — recorrências, orçamentos mensais e metas (componentes REAIS, jsdom).
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
    listRecurrences: vi.fn(),
    endRecurrence: vi.fn(),
    confirmEntry: vi.fn(),
    listBudgets: vi.fn(),
    setBudget: vi.fn(),
    copyBudgets: vi.fn(),
    listGoals: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    contributeGoal: vi.fn(),
  },
}));

import { FinancePage } from "../../src/pages/FinancePage";
import { financeService } from "../../src/services/FinanceService";
import type { BudgetLine, FinEntry, FinGoal, FinProfile, FinRecurrence } from "../../src/types/finance";
import { STAFF, renderApp } from "./support/harness";

const api = vi.mocked(financeService);
afterEach(cleanup);

const OVERVIEW = {
  consolidated: true,
  profiles: [
    { profileId: "p-pf", name: "Pessoa Física", kind: "pf" as const, incomeCents: 300_000, expenseCents: 200_000, resultCents: 100_000, liquidCents: 500_000, cardDebtCents: 0 },
    { profileId: "p-pj", name: "Empresa", kind: "pj" as const, incomeCents: 1_000_000, expenseCents: 20_000, resultCents: 980_000, liquidCents: 2_000_000, cardDebtCents: 50_000 },
  ],
  positions: { liquidCents: 2_500_000, cardDebtCents: 50_000, netCents: 2_450_000 },
};

const PROFILES: FinProfile[] = [
  { id: "p-pf", name: "Pessoa Física", kind: "pf", archived: false, taxProvisionBps: null },
  { id: "p-pj", name: "Empresa", kind: "pj", archived: false, taxProvisionBps: 600 },
];

const RECURRENCE: FinRecurrence = {
  id: "r1",
  profileId: "p-pf",
  frequency: "monthly",
  startDate: "2031-01-05",
  endDate: null,
  mode: "manual",
  status: "active",
  kind: "expense",
  description: "Aluguel",
  amountCents: 250_000,
  categoryId: null,
  accountId: null,
  nextDate: "2031-04-05",
  pendingApprovals: 1,
};

const LINE: BudgetLine = {
  categoryId: "c-food",
  name: "Alimentação",
  color: "#2ee66e",
  rollover: true,
  source: "month",
  budgetCents: 40_000,
  carryCents: 3_000,
  availableCents: 43_000,
  spentCents: 30_000,
  remainingCents: 13_000,
  usedRatio: 30_000 / 43_000,
};

const GOAL: FinGoal = {
  id: "g1",
  profileId: "p-pf",
  name: "Reserva de emergência",
  kind: "emergency",
  targetCents: null,
  targetMonths: 6,
  accountId: null,
  deadline: null,
  archived: false,
  rowVersion: 1,
  savedCents: 600_000,
  effectiveTargetCents: 1_200_000,
  remainingCents: 600_000,
  progress: 0.5,
  averageMonthlyExpenseCents: 200_000,
  monthsCovered: 3,
};

const PENDING: FinEntry = {
  id: "e9",
  profileId: "p-pf",
  kind: "expense",
  scope: "pf",
  categoryId: null,
  accountId: null,
  amountCents: 250_000,
  description: "Aluguel",
  entryDate: "2031-04-05",
  dueDate: null,
  paidAt: null,
  paymentMethod: "",
  notes: "",
  recurrenceId: "r1",
  installmentNo: null,
  installmentTotal: null,
  isFixed: true,
  tags: [],
  client: null,
  project: null,
  confirmed: false,
  invoiceRef: null,
  isRefund: false,
  paymentState: null,
  status: "pending",
};

beforeEach(() => {
  vi.clearAllMocks();
  api.overview.mockResolvedValue(OVERVIEW);
  api.listProfiles.mockResolvedValue(PROFILES);
  api.dashboard.mockRejectedValue(new Error("não usado"));
  api.listCategories.mockResolvedValue([]);
  api.listAccounts.mockResolvedValue([]);
  api.listCards.mockResolvedValue([]);
  api.listRecurrences.mockResolvedValue([RECURRENCE]);
  api.listEntries.mockResolvedValue({ items: [PENDING], total: 1, page: 1, pageSize: 50 });
  api.listBudgets.mockResolvedValue([LINE]);
  api.listGoals.mockResolvedValue([GOAL]);
});

const open = () => renderApp(<FinancePage />, { user: STAFF, route: "/financeiro?aba=planejamento" });

describe("Planejamento", () => {
  it("lista a recorrência com próxima data e modo, e a fila de aprovação", async () => {
    open();
    const list = await screen.findByRole("list", { name: "Recorrências ativas" });
    expect(within(list).getByText(/Aluguel/)).toBeTruthy();
    expect(within(list).getByText(/próxima/).textContent).toMatch(/com aprovação/);
    expect(within(list).getByText(/1 aguardando aprovação/)).toBeTruthy();
    expect(api.listEntries).toHaveBeenCalledWith(expect.objectContaining({ unconfirmed: true }));
    const queue = await screen.findByRole("list", { name: "Aguardando aprovação" });
    api.confirmEntry.mockResolvedValue(PENDING);
    fireEvent.click(within(queue).getByRole("button", { name: /Aprovar Aluguel/ }));
    await waitFor(() => expect(api.confirmEntry).toHaveBeenCalledWith("e9"));
    expect(screen.getByText(/não dá baixa/)).toBeTruthy();
  });

  it("encerra a recorrência depois de confirmar", async () => {
    api.endRecurrence.mockResolvedValue();
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Encerrar recorrência Aluguel" }));
    const dialog = await screen.findByRole("dialog", { name: "Encerrar a recorrência?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(api.endRecurrence).toHaveBeenCalledWith("r1"));
  });

  it("mostra o orçamento do mês com a sobra e salva um valor novo ao sair do campo", async () => {
    api.setBudget.mockResolvedValue();
    open();
    const row = (await screen.findByText("Alimentação")).closest("tr") as HTMLElement;
    expect(within(row).getByText(/sobra passa adiante/)).toBeTruthy();
    expect(within(row).getByText(/\+R\$\s30,00 da sobra/)).toBeTruthy();
    const input = within(row).getByLabelText("Orçamento de Alimentação");
    fireEvent.change(input, { target: { value: "50000" } });
    fireEvent.focusOut(input);
    await waitFor(() => expect(api.setBudget).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.setBudget).toHaveBeenCalledWith("c-food", expect.stringMatching(/^\d{4}-\d{2}$/), 50_000);
  });

  it("copia o mês anterior", async () => {
    api.copyBudgets.mockResolvedValue(2);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Copiar mês anterior" }));
    await waitFor(() => expect(api.copyBudgets).toHaveBeenCalledTimes(1));
    const [profile, from, to, overwrite] = api.copyBudgets.mock.calls[0]!;
    expect(profile).toBe("p-pf");
    expect(from < to).toBe(true);
    expect(overwrite).toBeUndefined();
    expect(await screen.findByText(/2 orçamentos copiados/)).toBeTruthy();
  });

  it("mostra a reserva de emergência com os meses cobertos", async () => {
    open();
    const goals = await screen.findByRole("list", { name: "Metas" });
    expect(within(goals).getByText(/cobre 3 de 6 meses de despesa/)).toBeTruthy();
    expect(within(goals).getByRole("img", { name: /50% da meta/ })).toBeTruthy();
  });

  it("cria uma meta com valor-alvo e uma reserva em meses", async () => {
    api.createGoal.mockResolvedValue(GOAL);
    open();
    const section = await screen.findByRole("region", { name: /Metas e reserva/ });
    fireEvent.change(within(section).getByLabelText("Nome"), { target: { value: "Viagem" } });
    fireEvent.change(within(section).getByLabelText("Valor-alvo"), { target: { value: "800000" } });
    fireEvent.click(within(section).getByRole("button", { name: "Adicionar meta" }));
    await waitFor(() => expect(api.createGoal).toHaveBeenCalledTimes(1));
    expect(api.createGoal.mock.calls[0]![0]).toEqual({
      profileId: "p-pf",
      name: "Viagem",
      kind: "goal",
      targetCents: 800_000,
    });
    fireEvent.change(within(section).getByLabelText("Tipo"), { target: { value: "emergency" } });
    fireEvent.change(within(section).getByLabelText("Nome"), { target: { value: "Reserva PF" } });
    fireEvent.change(within(section).getByLabelText("Meses de despesa"), { target: { value: "9" } });
    fireEvent.click(within(section).getByRole("button", { name: "Adicionar meta" }));
    await waitFor(() => expect(api.createGoal).toHaveBeenCalledTimes(2));
    expect(api.createGoal.mock.calls[1]![0]).toMatchObject({ kind: "emergency", targetMonths: 9 });
  });

  it("guarda um valor numa meta manual", async () => {
    api.contributeGoal.mockResolvedValue(GOAL);
    vi.spyOn(window, "prompt").mockReturnValue("250,50");
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Guardar em Reserva de emergência" }));
    await waitFor(() => expect(api.contributeGoal).toHaveBeenCalledWith("g1", 25_050));
  });
});
