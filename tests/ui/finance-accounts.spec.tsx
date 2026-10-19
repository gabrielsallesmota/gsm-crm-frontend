// Financeiro V2 / E3 — contas com saldo, transferências, conciliação e tags (componentes REAIS, jsdom).
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/FinanceService", () => ({
  financeService: {
    listProfiles: vi.fn(),
    dashboard: vi.fn(),
    listEntries: vi.fn(),
    createEntries: vi.fn(),
    listCategories: vi.fn(),
    listAccounts: vi.fn(),
    listCards: vi.fn(),
    listTransfers: vi.fn(),
    createTransfer: vi.fn(),
    deleteTransfer: vi.fn(),
    reconcile: vi.fn(),
    createAccount: vi.fn(),
  },
}));

import { FinancePage } from "../../src/pages/FinancePage";
import { financeService } from "../../src/services/FinanceService";
import type { FinAccount, FinCategory, FinEntry, FinProfile, FinTransfer } from "../../src/types/finance";
import { STAFF, renderApp } from "./support/harness";

const api = vi.mocked(financeService);
afterEach(cleanup);

const PROFILES: FinProfile[] = [
  { id: "p-pf", name: "Pessoa Física", kind: "pf", archived: false },
  { id: "p-pj", name: "GSM Automação — Pessoa Jurídica", kind: "pj", archived: false },
];

function account(over: Partial<FinAccount>): FinAccount {
  return {
    id: "a1",
    profileId: "p-pj",
    name: "Conta PJ",
    scope: "pj",
    kind: "conta",
    archived: false,
    closingDay: null,
    dueDay: null,
    creditLimitCents: null,
    institution: "Banco X",
    initialBalanceCents: 0,
    initialBalanceDate: null,
    lastReconciledOn: null,
    lastReconciledBalanceCents: null,
    balanceCents: 700_000,
    projectedCents: 650_000,
    ...over,
  };
}

const ACCOUNTS = [
  account({}),
  account({ id: "a2", profileId: "p-pf", name: "Conta PF", scope: "pf", balanceCents: 310_000, projectedCents: 310_000 }),
  account({ id: "c1", name: "Cartão", kind: "cartao", closingDay: 10, dueDay: 20, balanceCents: null, projectedCents: null }),
];

const TRANSFER: FinTransfer = {
  id: "t1",
  kind: "pro_labore",
  fromAccountId: "a1",
  fromProfileId: "p-pj",
  toAccountId: "a2",
  toProfileId: "p-pf",
  amountCents: 300_000,
  transferDate: "2031-03-05",
  description: "Pró-labore de março",
  notes: null,
  rowVersion: 1,
};

const CATEGORY: FinCategory = {
  id: "c-soft",
  profileId: "p-pj",
  name: "Ferramentas",
  kind: "expense",
  scope: "pj",
  color: "#4aa3ff",
  monthlyBudgetCents: null,
  archived: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listProfiles.mockResolvedValue(PROFILES);
  api.dashboard.mockRejectedValue(new Error("não usado nesta aba"));
  api.listCategories.mockResolvedValue([CATEGORY]);
  api.listAccounts.mockResolvedValue(ACCOUNTS);
  api.listCards.mockResolvedValue([]);
  api.listTransfers.mockResolvedValue([TRANSFER]);
  api.listEntries.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
});

const open = (route = "/financeiro?aba=contas") => renderApp(<FinancePage />, { user: STAFF, route });

describe("Contas", () => {
  it("mostra saldo atual e previsto por conta (cartão fica de fora) e a soma", async () => {
    open();
    const region = await screen.findByRole("region", { name: "Saldos das contas" });
    expect(within(region).getByText("Conta PJ")).toBeTruthy();
    expect(within(region).getByText(/R\$\s7\.000,00/)).toBeTruthy();
    expect(within(region).getByText(/previsto R\$\s6\.500,00/)).toBeTruthy();
    expect(within(region).queryByText("Cartão")).toBeNull();
    expect(within(region).getByText(/Soma dos saldos/).textContent).toMatch(/R\$\s10\.100,00/);
  });

  it("lista a transferência e explica que não é receita nem despesa", async () => {
    open();
    const list = await screen.findByRole("list", { name: "Transferências" });
    expect(within(list).getByText(/Pró-labore de março/)).toBeTruthy();
    expect(screen.getByText(/não é receita nem despesa/)).toBeTruthy();
  });

  it("cria uma transferência com tipo, contas, valor e data", async () => {
    api.createTransfer.mockResolvedValue(TRANSFER);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "+ Transferência" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova transferência" });
    fireEvent.change(within(dialog).getByLabelText("Tipo"), { target: { value: "pro_labore" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "300000" } });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Pró-labore" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Transferir" }));
    await waitFor(() => expect(api.createTransfer).toHaveBeenCalledTimes(1));
    expect(api.createTransfer.mock.calls[0]![0]).toMatchObject({
      kind: "pro_labore",
      fromAccountId: "a1",
      toAccountId: "a2",
      amountCents: 300_000,
      description: "Pró-labore",
    });
  });

  it("não deixa transferir de uma conta para ela mesma", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "+ Transferência" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova transferência" });
    fireEvent.change(within(dialog).getByLabelText("Para"), { target: { value: "a1" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "100" } });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "x" } });
    expect((within(dialog).getByRole("button", { name: "Transferir" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("exclui a transferência", async () => {
    api.deleteTransfer.mockResolvedValue();
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir transferência Pró-labore de março" }));
    await waitFor(() => expect(api.deleteTransfer).toHaveBeenCalledWith("t1"));
  });

  it("concilia: mostra a diferença para o extrato e ajusta com um clique", async () => {
    api.reconcile
      .mockResolvedValueOnce({ systemCents: 700_000, statementCents: 712_500, differenceCents: 12_500, reconciled: false, adjustmentCents: null })
      .mockResolvedValueOnce({ systemCents: 700_000, statementCents: 712_500, differenceCents: 12_500, reconciled: true, adjustmentCents: 12_500 });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Conciliar ou ajustar Conta PJ" }));
    const dialog = await screen.findByRole("dialog", { name: "Conciliar Conta PJ" });
    fireEvent.change(within(dialog).getByLabelText("Saldo no extrato"), { target: { value: "712500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Conferir" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/R\$\s125,00 abaixo/);
    expect(api.reconcile.mock.calls[0]![1]).toMatchObject({ statementBalanceCents: 712_500, adjust: false });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar saldo" }));
    await waitFor(() => expect(api.reconcile.mock.calls[1]![1]).toMatchObject({ adjust: true }));
  });

  it("conta nova leva instituição e saldo inicial", async () => {
    api.createAccount.mockResolvedValue(account({}));
    open("/financeiro?aba=categorias");
    const section = await screen.findByRole("region", { name: "Contas e cartões" });
    fireEvent.change(within(section).getByLabelText("Nome"), { target: { value: "Reserva" } });
    fireEvent.change(within(section).getByLabelText("Instituição"), { target: { value: "Nubank" } });
    fireEvent.change(within(section).getByLabelText("Saldo inicial"), { target: { value: "150000" } });
    fireEvent.click(within(section).getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(api.createAccount).toHaveBeenCalledTimes(1));
    expect(api.createAccount.mock.calls[0]![0]).toMatchObject({
      name: "Reserva",
      institution: "Nubank",
      initialBalanceCents: 150_000,
    });
  });
});

describe("Tags e baixa agendada", () => {
  const entry = (over: Partial<FinEntry> = {}): FinEntry => ({
    id: "e1",
    profileId: "p-pj",
    kind: "expense",
    scope: "pj",
    categoryId: "c-soft",
    accountId: "a1",
    amountCents: 1000,
    description: "Hospedagem",
    entryDate: "2031-03-02",
    dueDate: null,
    paidAt: "2031-03-09",
    paymentMethod: "",
    notes: "",
    recurrenceId: null,
    installmentNo: null,
    installmentTotal: null,
    isFixed: false,
    tags: ["infra", "anual"],
    paymentState: "scheduled",
    status: "paid",
    ...over,
  });

  it("mostra tags e baixa agendada na lista e filtra por tag", async () => {
    api.listEntries.mockResolvedValue({ items: [entry()], total: 1, page: 1, pageSize: 50 });
    open("/financeiro?aba=lancamentos");
    const row = await screen.findByText("Hospedagem");
    const cell = row.closest("td") as HTMLElement;
    expect(cell.textContent).toMatch(/#infra #anual/);
    expect(cell.textContent).toMatch(/baixa agendada/);
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "infra" } });
    await waitFor(() =>
      expect(api.listEntries).toHaveBeenLastCalledWith(expect.objectContaining({ tag: "infra" })),
    );
  });

  it("o formulário envia as tags separadas por vírgula", async () => {
    api.createEntries.mockResolvedValue([entry()]);
    api.dashboard.mockResolvedValue({
      month: "2031-03",
      scope: "all",
      kpis: { income: 1, expense: 1, result: 0, incomePaid: 0, incomePending: 1, expensePaid: 0, expensePending: 1, savingsRate: null, previous: { income: 0, expense: 0, result: 0 } },
      byScope: { pf: { income: 0, expense: 0, result: 0 }, pj: { income: 0, expense: 0, result: 0 } },
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
    });
    open("/financeiro");
    fireEvent.click(await screen.findByRole("button", { name: "+ Novo lançamento" }));
    const dialog = await screen.findByRole("dialog", { name: "Novo lançamento" });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Domínio" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "5000" } });
    fireEvent.change(within(dialog).getByLabelText("Tags"), { target: { value: " infra, Anual ,," } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar lançamento" }));
    await waitFor(() => expect(api.createEntries).toHaveBeenCalledTimes(1));
    expect(api.createEntries.mock.calls[0]![0]).toMatchObject({ tags: ["infra", "Anual"] });
  });
});
