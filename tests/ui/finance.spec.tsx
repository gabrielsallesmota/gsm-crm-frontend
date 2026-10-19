// Financeiro interno da GSM — página, painel, lançamentos e categorias com os componentes REAIS
// (jsdom). O serviço de API é substituído: nada aqui chama rede.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/FinanceService", () => ({
  financeService: {
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    dashboard: vi.fn(),
    listEntries: vi.fn(),
    createEntries: vi.fn(),
    updateEntry: vi.fn(),
    payEntry: vi.fn(),
    unpayEntry: vi.fn(),
    deleteEntry: vi.fn(),
    reauth: vi.fn(),
    exportCsv: vi.fn(),
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    listAccounts: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    listCards: vi.fn(),
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    payInvoice: vi.fn(),
    unpayInvoice: vi.fn(),
  },
}));

import { FinancePage } from "../../src/pages/FinancePage";
import { financeService } from "../../src/services/FinanceService";
import type {
  CardOverview,
  FinAccount,
  FinCategory,
  FinEntry,
  FinProfile,
  FinanceDashboard,
  InvoiceDetail,
  InvoiceSummary,
} from "../../src/types/finance";
import { STAFF, renderApp } from "./support/harness";

const api = vi.mocked(financeService);

afterEach(cleanup);

const PF_ID = "p-pf";
const PJ_ID = "p-pj";
const PROFILES: FinProfile[] = [
  { id: PF_ID, name: "Pessoa Física", kind: "pf", archived: false },
  { id: PJ_ID, name: "GSM Automação — Pessoa Jurídica", kind: "pj", archived: false },
];

const CATEGORIES: FinCategory[] = [
  { id: "c-soft", profileId: PJ_ID, name: "Ferramentas e software", kind: "expense", scope: "pj", color: "#4aa3ff", monthlyBudgetCents: 20000, archived: false },
  { id: "c-home", profileId: PF_ID, name: "Moradia", kind: "expense", scope: "pf", color: "#f5b13d", monthlyBudgetCents: null, archived: false },
  { id: "c-cli", profileId: PJ_ID, name: "Clientes (serviços)", kind: "income", scope: "pj", color: "#2ee66e", monthlyBudgetCents: null, archived: false },
];

function dashboard(overrides: Partial<FinanceDashboard> = {}): FinanceDashboard {
  return {
    month: "2031-03",
    scope: "all",
    kpis: {
      income: 1_300_000,
      expense: 220_000,
      result: 1_080_000,
      incomePaid: 900_000,
      incomePending: 400_000,
      expensePaid: 220_000,
      expensePending: 0,
      savingsRate: 0.83,
      previous: { income: 500_000, expense: 0, result: 500_000 },
    },
    byScope: {
      pj: { income: 1_000_000, expense: 20_000, result: 980_000 },
      pf: { income: 300_000, expense: 200_000, result: 100_000 },
    },
    series: Array.from({ length: 12 }, (_, i) => ({
      month: `2030-${String(((i + 3) % 12) + 1).padStart(2, "0")}`,
      income: i * 1000,
      expense: i * 500,
      result: i * 500,
    })),
    categories: {
      expense: [
        { categoryId: "c-soft", name: "Ferramentas e software", color: "#4aa3ff", total: 25_000, count: 2, budgetCents: 20_000, budgetUsed: 1.25 },
        { categoryId: "c-home", name: "Moradia", color: "#f5b13d", total: 200_000, count: 1, budgetCents: null, budgetUsed: null },
      ],
      income: [{ categoryId: "c-cli", name: "Clientes (serviços)", color: "#2ee66e", total: 600_000, count: 1, budgetCents: null, budgetUsed: null }],
    },
    pending: {
      payableOverdue: { total: 1000, count: 1 },
      payableSoon: { total: 2000, count: 1 },
      receivableOverdue: { total: 0, count: 0 },
      receivableSoon: { total: 400_000, count: 1 },
      upcoming: [
        { id: "u1", description: "Servidor", kind: "expense", scope: "pj", amountCents: 1000, dueDate: "2031-03-05", overdue: true, category: "Servidor e hospedagem" },
      ],
    },
    topExpenses: [{ id: "t1", description: "Aluguel", scope: "pf", amountCents: 200_000, entryDate: "2031-03-08", category: "Moradia" }],
    daily: [{ date: "2031-03-08", income: 0, expense: 200_000 }],
    ...overrides,
  };
}

function entry(overrides: Partial<FinEntry> = {}): FinEntry {
  return {
    id: "e1",
    profileId: PJ_ID,
    kind: "expense",
    scope: "pj",
    categoryId: "c-soft",
    accountId: null,
    amountCents: 15_000,
    description: "Ferramentas",
    entryDate: "2031-03-02",
    dueDate: null,
    paidAt: null,
    paymentMethod: "",
    notes: "",
    recurrenceId: null,
    installmentNo: null,
    installmentTotal: null,
    isFixed: false,
    status: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listProfiles.mockResolvedValue(PROFILES);
  api.dashboard.mockResolvedValue(dashboard());
  api.listCategories.mockResolvedValue(CATEGORIES);
  api.listAccounts.mockResolvedValue([]);
  api.listCards.mockResolvedValue([]);
  api.listEntries.mockResolvedValue({ items: [entry()], total: 1, page: 1, pageSize: 50 });
});

function open(route = "/financeiro") {
  return renderApp(<FinancePage />, { user: STAFF, route });
}

describe("Painel", () => {
  it("mostra receitas, despesas, resultado, PF × PJ e a variação contra o mês anterior", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Receitas" })).toBeTruthy();
    expect(screen.getAllByText(/R\$\s13\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s10\.800,00/)).toBeTruthy(); // resultado
    expect(screen.getByText(/83% da receita sobra/)).toBeTruthy();
    expect(screen.getByText("+160%")).toBeTruthy(); // receita 13.000 vs 5.000
    const split = screen.getByRole("heading", { name: "PF × PJ" }).closest("section") as HTMLElement;
    expect(within(split).getByText(/Resultado\s+R\$\s9\.800,00/)).toBeTruthy();
    expect(within(split).getByText(/Resultado\s+R\$\s1\.000,00/)).toBeTruthy();
  });

  it("avisa orçamento estourado e lista pendências e o gráfico acessível por tabela", async () => {
    open();
    expect(await screen.findByText(/Orçamento R\$\s200,00 · 125% usado — estourou/)).toBeTruthy();
    expect(screen.getByText("A pagar vencido")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Próximos vencimentos" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /últimos 12 meses/ })).toBeTruthy();
    expect(screen.getByRole("table", { name: /por mês/ })).toBeTruthy();
  });

  it("mês sem lançamentos mostra o estado vazio com a ação de criar", async () => {
    api.dashboard.mockResolvedValue(
      dashboard({
        kpis: { ...dashboard().kpis, income: 0, expense: 0, result: 0 },
        pending: { ...dashboard().pending, upcoming: [] },
      }),
    );
    open();
    expect(await screen.findByText(/Nenhum lançamento neste mês/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "+ Novo lançamento" })).toHaveLength(2); // cabeçalho + estado vazio
  });

  it("troca de mês e de perfil refaz a consulta com os parâmetros certos", async () => {
    open();
    await screen.findByRole("heading", { name: "Receitas" });
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    await waitFor(() => expect(api.dashboard).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Pessoa Física" }));
    await waitFor(() =>
      expect(api.dashboard).toHaveBeenLastCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), PF_ID),
    );
    // com um perfil escolhido o comparativo PF × PJ some; o consolidado o mostra
    expect(screen.queryByRole("heading", { name: "PF × PJ" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Consolidado" }));
    await waitFor(() => expect(api.dashboard).toHaveBeenLastCalledWith(expect.any(String), undefined));
  });

  it("erro do servidor vira mensagem com 'Tentar de novo'", async () => {
    api.dashboard.mockRejectedValueOnce(new Error("falhou"));
    open();
    expect(await screen.findByText("Não foi possível carregar o painel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("heading", { name: "Receitas" })).toBeTruthy();
  });
});

describe("Novo lançamento", () => {
  async function openForm() {
    open();
    await screen.findByRole("heading", { name: "Receitas" });
    fireEvent.click(screen.getByRole("button", { name: "+ Novo lançamento" }));
    return await screen.findByRole("dialog", { name: "Novo lançamento" });
  }

  it("só oferece categorias do tipo e do perfil escolhidos", async () => {
    const dialog = await openForm();
    const select = within(dialog).getByLabelText("Categoria") as HTMLSelectElement;
    const options = () => Array.from(select.options).map((o) => o.textContent);
    expect(options()).toEqual(["Sem categoria", "Ferramentas e software"]); // despesa PJ
    fireEvent.click(within(dialog).getByLabelText("Pessoa Física"));
    expect(options()).toEqual(["Sem categoria", "Moradia"]);
    fireEvent.click(within(dialog).getByLabelText("Receita"));
    expect(options()).toEqual(["Sem categoria"]); // nenhuma receita PF cadastrada
  });

  it("bloqueia envio inválido e mostra o motivo", async () => {
    const dialog = await openForm();
    const create = within(dialog).getByRole("button", { name: "Criar lançamento" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(within(dialog).getByRole("alert").textContent).toMatch(/descrição/);
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Hospedagem" } });
    expect(within(dialog).getByRole("alert").textContent).toMatch(/maior que zero/);
  });

  it("cria uma série mensal com valor, categoria e repetição", async () => {
    api.createEntries.mockResolvedValue([entry(), entry({ id: "e2" })]);
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Hospedagem" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "9900" } }); // R$ 99,00
    fireEvent.change(within(dialog).getByLabelText("Categoria"), { target: { value: "c-soft" } });
    fireEvent.change(within(dialog).getByLabelText("Repetição"), { target: { value: "months" } });
    fireEvent.change(within(dialog).getByLabelText("Repetir por (meses)"), { target: { value: "12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar lançamento" }));
    await waitFor(() => expect(api.createEntries).toHaveBeenCalledTimes(1));
    expect(api.createEntries.mock.calls[0]![0]).toMatchObject({
      kind: "expense",
      profileId: PJ_ID,
      description: "Hospedagem",
      amountCents: 9900,
      categoryId: "c-soft",
      repeatMonths: 12,
    });
  });
});

describe("Lançamentos", () => {
  async function openEntries() {
    open("/financeiro?aba=lancamentos");
    return await screen.findByText("Ferramentas");
  }

  it("lista, baixa e estorna", async () => {
    api.payEntry.mockResolvedValue(entry({ paidAt: "2031-03-02", status: "paid" }));
    await openEntries();
    fireEvent.click(screen.getByRole("button", { name: "Pagar" }));
    await waitFor(() => expect(api.payEntry).toHaveBeenCalledWith("e1"));
  });

  it("exclusão de lançamento de série oferece 'só este' e 'este e os próximos'", async () => {
    api.listEntries.mockResolvedValue({
      items: [entry({ recurrenceId: "r1", installmentNo: 2, installmentTotal: 6 })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    api.deleteEntry.mockResolvedValue(4);
    await openEntries();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Ferramentas" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir lançamento?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Este e os próximos" }));
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith("e1", true));
  });

  it("filtra por situação enviando o parâmetro ao servidor", async () => {
    await openEntries();
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "overdue" } });
    await waitFor(() =>
      expect(api.listEntries).toHaveBeenLastCalledWith(expect.objectContaining({ status: "overdue" })),
    );
  });
});

describe("Categorias e contas", () => {
  it("cria despesa com orçamento e arquiva", async () => {
    api.createCategory.mockResolvedValue(CATEGORIES[0]!);
    api.updateCategory.mockResolvedValue(CATEGORIES[0]!);
    open("/financeiro?aba=categorias");
    const cats = await screen.findByRole("region", { name: "Categorias" });
    fireEvent.change(within(cats).getByLabelText("Nome"), { target: { value: "Cursos" } });
    fireEvent.change(within(cats).getByLabelText("Orçamento mensal"), { target: { value: "50000" } });
    fireEvent.click(within(cats).getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(api.createCategory).toHaveBeenCalledTimes(1));
    expect(api.createCategory.mock.calls[0]![0]).toMatchObject({
      name: "Cursos",
      kind: "expense",
      profileId: PF_ID,
      monthlyBudgetCents: 50000,
    });
    fireEvent.click(within(cats).getByRole("button", { name: "Arquivar Moradia" }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith("c-home", { archived: true }));
  });
});

// ---------------------------------------------------------------------------------------------
// Cartão de crédito e faturas
// ---------------------------------------------------------------------------------------------

const CARD: FinAccount = {
  id: "card1",
  profileId: PJ_ID,
  name: "Nubank PJ",
  scope: "pj",
  kind: "cartao",
  archived: false,
  closingDay: 10,
  dueDay: 20,
  creditLimitCents: 500_000,
};

function invoice(overrides: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    ref: "2031-03",
    periodStart: "2031-02-11",
    closingDate: "2031-03-10",
    dueDate: "2031-03-20",
    total: 50_000,
    paidTotal: 0,
    count: 2,
    unpaidCount: 2,
    paidOn: null,
    status: "closed",
    ...overrides,
  };
}

function overview(overrides: Partial<CardOverview> = {}): CardOverview {
  return {
    account: CARD,
    usedCents: 450_000,
    availableCents: 50_000,
    current: invoice(),
    next: invoice({ ref: "2031-04", total: 0, count: 0, unpaidCount: 0, status: "open" }),
    ...overrides,
  };
}

function detail(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    card: CARD,
    invoice: invoice(),
    entries: [
      entry({ id: "p1", description: "Notebook", amountCents: 30_000, accountId: "card1", installmentNo: 1, installmentTotal: 3 }),
      entry({ id: "p2", description: "Domínio", amountCents: 20_000, accountId: "card1" }),
    ],
    byCategory: [{ name: "Ferramentas e software", color: "#4aa3ff", total: 50_000, count: 2 }],
    ...overrides,
  };
}

describe("Cartões", () => {
  beforeEach(() => {
    api.listAccounts.mockResolvedValue([CARD]);
    api.listCards.mockResolvedValue([overview()]);
    api.listInvoices.mockResolvedValue([invoice(), invoice({ ref: "2031-02", total: 1000, status: "paid", unpaidCount: 0 })]);
    api.getInvoice.mockResolvedValue(detail());
  });

  it("mostra o cartão, a fatura atual, o limite e o detalhe das compras com parcelas", async () => {
    open("/financeiro?aba=cartoes");
    const tile = await screen.findByRole("button", { name: /Nubank PJ/ });
    expect(within(tile).getAllByText(/R\$\s500,00/).length).toBeGreaterThan(0);
    expect(within(tile).getByText(/Fechada/)).toBeTruthy();
    expect(within(tile).getByText(/disponível de/)).toBeTruthy();
    expect(await screen.findByText("Notebook")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.getByText("à vista")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Fatura por categoria" })).toBeTruthy();
    expect(api.getInvoice).toHaveBeenCalledWith("card1", "2031-03");
  });

  it("paga a fatura depois de confirmar e avisa que não duplica a despesa", async () => {
    api.payInvoice.mockResolvedValue(2);
    open("/financeiro?aba=cartoes");
    fireEvent.click(await screen.findByRole("button", { name: "Pagar fatura" }));
    const dialog = await screen.findByRole("dialog", { name: "Pagar a fatura?" });
    expect(within(dialog).getByText(/não cria uma despesa nova/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Pagar fatura" }));
    await waitFor(() => expect(api.payInvoice).toHaveBeenCalledWith("card1", "2031-03", undefined));
  });

  it("estorna o pagamento de fatura paga e troca de fatura pelo seletor", async () => {
    api.getInvoice.mockResolvedValue(
      detail({ invoice: invoice({ status: "paid", paidTotal: 50_000, unpaidCount: 0, paidOn: "2031-03-18" }) }),
    );
    api.unpayInvoice.mockResolvedValue(2);
    open("/financeiro?aba=cartoes");
    expect(screen.queryByRole("button", { name: "Pagar fatura" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Estornar pagamento" }));
    const dialog = await screen.findByRole("dialog", { name: "Estornar o pagamento?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Estornar" }));
    await waitFor(() => expect(api.unpayInvoice).toHaveBeenCalledWith("card1", "2031-03"));

    const picker = screen.getByRole("group", { name: "Escolher fatura" });
    fireEvent.click(within(picker).getAllByRole("button")[1]!);
    await waitFor(() => expect(api.getInvoice).toHaveBeenLastCalledWith("card1", "2031-02"));
  });

  it("cadastra cartão com fechamento, vencimento e limite — e bloqueia dia inválido", async () => {
    api.listCards.mockResolvedValue([]);
    api.createAccount.mockResolvedValue(CARD);
    open("/financeiro?aba=cartoes");
    fireEvent.click(await screen.findByRole("button", { name: "+ Novo cartão" }));
    const form = screen.getByRole("group", { name: "Novo cartão" });
    fireEvent.change(within(form).getByLabelText("Nome"), { target: { value: "Inter PF" } });
    fireEvent.change(within(form).getByLabelText("Perfil"), { target: { value: PF_ID } });
    fireEvent.change(within(form).getByLabelText("Dia do fechamento"), { target: { value: "30" } });
    expect((within(form).getByRole("button", { name: "Cadastrar cartão" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText("Dia do fechamento"), { target: { value: "25" } });
    fireEvent.change(within(form).getByLabelText("Dia do vencimento"), { target: { value: "5" } });
    fireEvent.change(within(form).getByLabelText("Limite"), { target: { value: "800000" } });
    fireEvent.click(within(form).getByRole("button", { name: "Cadastrar cartão" }));
    await waitFor(() => expect(api.createAccount).toHaveBeenCalledTimes(1));
    expect(api.createAccount.mock.calls[0]![0]).toEqual({
      name: "Inter PF",
      profileId: PF_ID,
      kind: "cartao",
      closingDay: 25,
      dueDay: 5,
      creditLimitCents: 800000,
    });
  });

  it("compra no cartão nasce 'a pagar', só despesa, e mostra em que fatura cai", async () => {
    open("/financeiro?aba=cartoes");
    fireEvent.click(await screen.findByRole("button", { name: "+ Compra no cartão" }));
    const dialog = await screen.findByRole("dialog", { name: "Novo lançamento" });
    expect((within(dialog).getByLabelText("Conta / cartão") as HTMLSelectElement).value).toBe("card1");
    expect((within(dialog).getByLabelText("Já pago?") as HTMLSelectElement).value).toBe("0");
    fireEvent.change(within(dialog).getByLabelText("Data do lançamento"), { target: { value: "2031-03-11" } });
    expect(within(dialog).getByText(/entra na fatura que vence em 20\/04\/2031/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Data do lançamento"), { target: { value: "2031-03-10" } });
    expect(within(dialog).getByText(/vence em 20\/03\/2031/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Repetição"), { target: { value: "months" } });
    expect(within(dialog).getByLabelText("Parcelado em (vezes)")).toBeTruthy();
    expect(within(dialog).getByText("Valor de cada parcela")).toBeTruthy();
  });

  it("o painel resume a fatura atual dos cartões", async () => {
    open("/financeiro");
    const list = await screen.findByRole("list", { name: "Faturas dos cartões" });
    expect(within(list).getByText(/Nubank PJ/)).toBeTruthy();
    expect(within(list).getAllByText(/R\$\s500,00/).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Fixo, edição de série e cadastros editáveis / desarquivar
// ---------------------------------------------------------------------------------------------

describe("Lançamento fixo e edição de série", () => {
  async function openForm() {
    open();
    await screen.findByRole("heading", { name: "Receitas" });
    fireEvent.click(screen.getByRole("button", { name: "+ Novo lançamento" }));
    return await screen.findByRole("dialog", { name: "Novo lançamento" });
  }

  it("repetição 'fixo' envia fixed=true (sem número de meses) e explica como parar", async () => {
    api.createEntries.mockResolvedValue([entry()]);
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Aluguel do escritório" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "250000" } });
    fireEvent.change(within(dialog).getByLabelText("Repetição"), { target: { value: "fixed" } });
    expect(within(dialog).queryByLabelText("Repetir por (meses)")).toBeNull();
    expect(within(dialog).getByText(/Para parar, exclua/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar lançamento" }));
    await waitFor(() => expect(api.createEntries).toHaveBeenCalledTimes(1));
    expect(api.createEntries.mock.calls[0]![0]).toMatchObject({ fixed: true, repeatMonths: 1, amountCents: 250000 });
  });

  it("por padrão cria lançamento único", async () => {
    api.createEntries.mockResolvedValue([entry()]);
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Café" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "1000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar lançamento" }));
    await waitFor(() => expect(api.createEntries).toHaveBeenCalledTimes(1));
    expect(api.createEntries.mock.calls[0]![0]).toMatchObject({ fixed: false, repeatMonths: 1 });
  });

  async function editSeriesEntry() {
    api.listEntries.mockResolvedValue({
      items: [entry({ recurrenceId: "r1", installmentNo: 2, installmentTotal: 6 })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    open("/financeiro?aba=lancamentos");
    await screen.findByText("Ferramentas");
    fireEvent.click(screen.getByRole("button", { name: "Editar Ferramentas" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar lançamento" });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "20000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    return await screen.findByRole("dialog", { name: "Aplicar a quais lançamentos?" });
  }

  it("editar item de série pergunta onde aplicar e usa 'somente este' por padrão", async () => {
    api.updateEntry.mockResolvedValue(entry());
    const ask = await editSeriesEntry();
    expect((within(ask).getByLabelText(/Somente este lançamento/) as HTMLInputElement).checked).toBe(true);
    expect(api.updateEntry).not.toHaveBeenCalled(); // nada foi enviado antes da escolha
    fireEvent.click(within(ask).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledTimes(1));
    expect(api.updateEntry.mock.calls[0]![2]).toBe("this");
  });

  it.each([
    ["Este e os seguintes", "future"],
    ["Todos da série", "all"],
  ])("escolhendo '%s' envia apply=%s e avisa quantos mudaram", async (label, apply) => {
    api.updateEntry.mockResolvedValue(entry({ affected: 4 }));
    const ask = await editSeriesEntry();
    fireEvent.click(within(ask).getByLabelText(new RegExp(label)));
    fireEvent.click(within(ask).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateEntry.mock.calls[0]?.[2]).toBe(apply));
    expect(await screen.findByText("4 lançamentos atualizados")).toBeTruthy();
  });

  it("lançamento avulso edita direto, sem perguntar", async () => {
    api.updateEntry.mockResolvedValue(entry());
    open("/financeiro?aba=lancamentos");
    await screen.findByText("Ferramentas");
    fireEvent.click(screen.getByRole("button", { name: "Editar Ferramentas" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar lançamento" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: "Aplicar a quais lançamentos?" })).toBeNull();
  });

  it("excluir item de série fixa explica como encerrar", async () => {
    api.listEntries.mockResolvedValue({
      items: [entry({ recurrenceId: "r1", isFixed: true })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    open("/financeiro?aba=lancamentos");
    await screen.findByText("Ferramentas");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Ferramentas" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir lançamento?" });
    expect(within(dialog).getByText(/é assim que se encerra um lançamento fixo/)).toBeTruthy();
  });
});

describe("Perfis", () => {
  it("cria um perfil novo, renomeia e arquiva", async () => {
    api.createProfile.mockResolvedValue({ id: "p-3", name: "Loja", kind: "pj", archived: false });
    api.updateProfile.mockResolvedValue(PROFILES[0]!);
    open("/financeiro?aba=categorias");
    const section = await screen.findByRole("region", { name: "Perfis" });
    fireEvent.change(within(section).getByLabelText("Nome"), { target: { value: "Loja" } });
    fireEvent.click(within(section).getByRole("button", { name: "Adicionar perfil" }));
    await waitFor(() => expect(api.createProfile).toHaveBeenCalledWith({ name: "Loja", kind: "pj" }));
    fireEvent.click(within(section).getByRole("button", { name: "Arquivar Pessoa Física" }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith(PF_ID, { archived: true }));
    fireEvent.click(within(section).getByRole("button", { name: "Renomear Pessoa Física" }));
    fireEvent.change(within(section).getByLabelText("Novo nome de Pessoa Física"), { target: { value: "Pessoal" } });
    fireEvent.click(within(section).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith(PF_ID, { name: "Pessoal" }));
  });

  it("com um perfil escolhido, categorias e contas mostram só as dele", async () => {
    open("/financeiro?aba=categorias");
    await screen.findByRole("region", { name: "Categorias" });
    expect(screen.getByText("Moradia")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "GSM Automação — Pessoa Jurídica" }));
    await waitFor(() => expect(screen.queryByText("Moradia")).toBeNull());
    expect(screen.getByText("Ferramentas e software")).toBeTruthy();
  });

  it("a exportação pede a senha antes de baixar", async () => {
    api.reauth.mockResolvedValue("tok");
    api.exportCsv.mockResolvedValue(new Blob(["x"]));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    open("/financeiro?aba=lancamentos");
    await screen.findByText("Ferramentas");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    const dialog = await screen.findByRole("dialog", { name: "Exportar CSV" });
    fireEvent.change(within(dialog).getByLabelText("Senha"), { target: { value: "segredo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(api.reauth).toHaveBeenCalledWith("segredo"));
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalledTimes(1));
    expect(api.exportCsv.mock.calls[0]![1]).toBe("tok");
  });
});

describe("Cadastros: editar e desarquivar", () => {
  const ARCHIVED: FinCategory = {
    id: "c-old",
    profileId: PF_ID,
    name: "Cursos antigos",
    kind: "expense",
    scope: "pf",
    color: "#a78bfa",
    monthlyBudgetCents: null,
    archived: true,
  };

  beforeEach(() => {
    api.listCategories.mockResolvedValue([...CATEGORIES, ARCHIVED]);
  });

  it("edita nome e orçamento da categoria (o perfil não muda)", async () => {
    api.updateCategory.mockResolvedValue(CATEGORIES[0]!);
    open("/financeiro?aba=categorias");
    fireEvent.click(await screen.findByRole("button", { name: "Editar Ferramentas e software" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar categoria" });
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Software e apps" } });
    expect(within(dialog).queryByLabelText("Vale para")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Orçamento mensal"), { target: { value: "35000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledTimes(1));
    expect(api.updateCategory.mock.calls[0]).toEqual([
      "c-soft",
      { name: "Software e apps", color: "#4aa3ff", monthlyBudgetCents: 35000 },
    ]);
  });

  it("categoria arquivada fica numa seção própria e pode ser desarquivada", async () => {
    api.updateCategory.mockResolvedValue(ARCHIVED);
    open("/financeiro?aba=categorias");
    expect(await screen.findByRole("button", { name: "Editar Moradia" })).toBeTruthy();
    expect(screen.queryByText("Cursos antigos")).toBeNull(); // escondida até abrir "Arquivadas"
    fireEvent.click(screen.getByRole("button", { name: "Arquivadas (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desarquivar Cursos antigos" }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith("c-old", { archived: false }));
  });

  it("edita conta e desarquiva conta", async () => {
    const acc = { ...CARD, id: "a1", name: "Banco PJ", kind: "conta" as const, closingDay: null, dueDay: null, creditLimitCents: null };
    const old = { ...acc, id: "a2", name: "Conta velha", archived: true };
    api.listAccounts.mockResolvedValue([acc, old]);
    api.updateAccount.mockResolvedValue(acc);
    open("/financeiro?aba=categorias");
    fireEvent.click(await screen.findByRole("button", { name: "Editar Banco PJ" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar conta" });
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Banco Inter PJ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateAccount).toHaveBeenCalledWith("a1", { name: "Banco Inter PJ" }));
    const sections = screen.getAllByRole("button", { name: "Arquivadas (1)" }); // categorias, contas
    fireEvent.click(sections[sections.length - 1]!);
    fireEvent.click(await screen.findByRole("button", { name: "Desarquivar Conta velha" }));
    await waitFor(() => expect(api.updateAccount).toHaveBeenCalledWith("a2", { archived: false }));
  });

  it("edita fechamento, vencimento e limite do cartão", async () => {
    api.listCards.mockResolvedValue([overview()]);
    api.listAccounts.mockResolvedValue([CARD]);
    api.listInvoices.mockResolvedValue([invoice()]);
    api.getInvoice.mockResolvedValue(detail());
    api.updateAccount.mockResolvedValue(CARD);
    open("/financeiro?aba=cartoes");
    fireEvent.click(await screen.findByRole("button", { name: "Editar cartão" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar cartão" });
    fireEvent.change(within(dialog).getByLabelText("Dia do fechamento"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Dia do vencimento"), { target: { value: "15" } });
    fireEvent.change(within(dialog).getByLabelText("Limite"), { target: { value: "900000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateAccount).toHaveBeenCalledTimes(1));
    expect(api.updateAccount.mock.calls[0]).toEqual([
      "card1",
      { name: "Nubank PJ", closingDay: 5, dueDay: 15, creditLimitCents: 900000 },
    ]);
  });
});
