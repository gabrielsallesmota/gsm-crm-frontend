// Financeiro V2 / E6 — importação de extrato: prévia sem gravar, decisões por linha e desfazer.
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
    previewImport: vi.fn(),
    commitImport: vi.fn(),
    listImports: vi.fn(),
    undoImport: vi.fn(),
  },
}));

import { FinancePage } from "../../src/pages/FinancePage";
import { financeService } from "../../src/services/FinanceService";
import type { FinAccount, ImportHistoryItem, ImportPreview } from "../../src/types/finance";
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

const BANK: FinAccount = {
  id: "bank1",
  profileId: "p-pf",
  name: "Banco",
  scope: "pf",
  kind: "conta",
  archived: false,
  closingDay: null,
  dueDay: null,
  creditLimitCents: null,
  institution: null,
  payerAccountId: null,
  initialBalanceCents: 0,
  initialBalanceDate: null,
  lastReconciledOn: null,
  lastReconciledBalanceCents: null,
  balanceCents: 0,
  projectedCents: 0,
};
const CARD: FinAccount = { ...BANK, id: "card1", name: "Cartão", kind: "cartao", balanceCents: null };

const PREVIEW: ImportPreview = {
  accountId: "bank1",
  source: "csv",
  total: 4,
  new: 1,
  duplicate: 1,
  match: 1,
  error: 1,
  incomeCents: 200_000,
  expenseCents: 12_345,
  ledgerBalanceCents: null,
  ledgerDate: null,
  warnings: [],
  alreadyImportedAt: null,
  rows: [
    { line: 2, posted: "2031-03-05", amountCents: 200_000, description: "Pix recebido", externalId: "A2", status: "new", error: null, match: null, defaultDecision: "import" },
    {
      line: 3,
      posted: "2031-03-05",
      amountCents: -12_345,
      description: "Mercado Central",
      externalId: "A1",
      status: "match",
      error: null,
      match: { entryId: "e-manual", description: "Mercado (na mão)", entryDate: "2031-03-04", amountCents: 12_345 },
      defaultDecision: "skip",
    },
    { line: 4, posted: "2031-03-06", amountCents: -1_590, description: "Tarifa", externalId: "A3", status: "duplicate", error: null, match: null, defaultDecision: "skip" },
    { line: 5, posted: null, amountCents: null, description: "", externalId: null, status: "error", error: "data inválida", match: null, defaultDecision: "skip" },
  ],
};

const HISTORY: ImportHistoryItem = {
  id: "imp1",
  accountId: "bank1",
  source: "csv",
  fileName: "marco.csv",
  status: "committed",
  rowsTotal: 4,
  rowsImported: 2,
  rowsLinked: 1,
  rowsSkipped: 1,
  createdAt: "2031-03-10T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  api.overview.mockResolvedValue(OVERVIEW);
  api.listProfiles.mockResolvedValue([{ id: "p-pf", name: "Pessoa Física", kind: "pf", archived: false, taxProvisionBps: null }]);
  api.dashboard.mockRejectedValue(new Error("não usado"));
  api.listCategories.mockResolvedValue([]);
  api.listAccounts.mockResolvedValue([BANK, CARD]);
  api.listCards.mockResolvedValue([]);
  api.listEntries.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  api.listImports.mockResolvedValue([HISTORY]);
  api.previewImport.mockResolvedValue(PREVIEW);
});

const open = () => renderApp(<FinancePage />, { user: STAFF, route: "/financeiro?aba=importar" });

async function pickFile() {
  const input = (await screen.findByLabelText("Arquivo")) as HTMLInputElement;
  const file = new File(["data;valor\n05/03/2031;1,00\n"], "extrato.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Ler arquivo" }) as HTMLButtonElement).disabled).toBe(false));
}

describe("Importar", () => {
  it("só oferece contas (cartão fica de fora) e não grava ao ler o arquivo", async () => {
    open();
    const select = (await screen.findByLabelText("Conta")) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["Banco (Pessoa Física)"]);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Ler arquivo" }));
    expect(await screen.findByText(/4 linhas/)).toBeTruthy();
    expect(api.previewImport).toHaveBeenCalledTimes(1);
    expect(api.commitImport).not.toHaveBeenCalled(); // prévia não confirma nada
    const [accountId, file] = api.previewImport.mock.calls[0]!;
    expect(accountId).toBe("bank1");
    expect(file.name).toBe("extrato.csv");
    expect(atob(file.contentBase64)).toContain("05/03/2031");
  });

  it("resume a prévia e mostra a decisão padrão de cada linha", async () => {
    open();
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Ler arquivo" }));
    const summary = (await screen.findByText(/4 linhas/)).closest("p") as HTMLElement;
    expect(summary.textContent).toMatch(/4 linhas/);
    expect(summary.textContent).toMatch(/1 novas · 1 parecidas com lançamentos seus · 1 já existentes · 1 com erro/);
    const table = screen.getByRole("table");
    expect((within(table).getByLabelText("Linha 2") as HTMLSelectElement).value).toBe("import");
    expect((within(table).getByLabelText("Linha 3") as HTMLSelectElement).value).toBe("skip");
    expect(within(table).getAllByText("Ignorada")).toHaveLength(2); // duplicada e erro
    expect(within(table).getByText("data inválida")).toBeTruthy();
  });

  it("confirma enviando as decisões (vincular a linha parecida) e atualiza o histórico", async () => {
    api.commitImport.mockResolvedValue({ id: "imp2", rowsTotal: 4, rowsImported: 1, rowsLinked: 1, rowsSkipped: 2 });
    open();
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Ler arquivo" }));
    const table = await screen.findByRole("table");
    fireEvent.change(within(table).getByLabelText("Linha 3"), { target: { value: "link:e-manual" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar importação \(1 novas · 1 vinculadas\)/ }));
    await waitFor(() => expect(api.commitImport).toHaveBeenCalledTimes(1));
    const [accountId, , options] = api.commitImport.mock.calls[0]!;
    expect(accountId).toBe("bank1");
    expect(options?.decisions).toEqual({ 2: "import", 3: "link:e-manual", 4: "skip", 5: "skip" });
    expect(await screen.findByText(/1 importadas · 1 vinculadas · 2 ignoradas/)).toBeTruthy();
    expect(api.listImports.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("avisa quando o arquivo já foi importado", async () => {
    api.previewImport.mockResolvedValue({ ...PREVIEW, alreadyImportedAt: "2031-03-10T12:00:00Z" });
    open();
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Ler arquivo" }));
    expect(await screen.findByText(/já foi importado nesta conta/)).toBeTruthy();
  });

  it("mostra erro do servidor ao ler e não deixa confirmar sem nada para importar", async () => {
    api.previewImport.mockRejectedValueOnce(new Error("Não parece um arquivo OFX"));
    open();
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Ler arquivo" }));
    await waitFor(() => expect(api.previewImport).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("table")).toBeNull();
    api.previewImport.mockResolvedValue({ ...PREVIEW, rows: PREVIEW.rows.map((r) => ({ ...r, defaultDecision: "skip" as const })) });
    fireEvent.click(screen.getByRole("button", { name: "Ler arquivo" }));
    const confirm = await screen.findByRole("button", { name: /Confirmar importação/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("desfaz uma importação depois de confirmar", async () => {
    api.undoImport.mockResolvedValue({ removed: 2, restored: 1 });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer importação marco.csv" }));
    const dialog = await screen.findByRole("dialog", { name: "Desfazer a importação?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(api.undoImport).toHaveBeenCalledWith("imp1"));
  });
});
