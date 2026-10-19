// Financeiro V2 — conta de recebimento na ficha do cliente (só o proprietário enxerga).
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/FinanceService", () => ({
  financeService: {
    listClientLinks: vi.fn(),
    listAccounts: vi.fn(),
    listProfiles: vi.fn(),
    setClientLink: vi.fn(),
    removeClientLink: vi.fn(),
  },
}));

import { ClientReceivingAccount } from "../../src/components/clients/ClientReceivingAccount";
import { financeService } from "../../src/services/FinanceService";
import type { FinAccount, FinProfile } from "../../src/types/finance";
import { ADMIN, renderApp } from "./support/harness";

const api = vi.mocked(financeService);
afterEach(cleanup);

const PROFILES: FinProfile[] = [
  {
    id: "p-pj",
    name: "GSM Automação — Pessoa Jurídica",
    kind: "pj",
    archived: false,
    taxProvisionBps: null,
  },
];
const account = (over: Partial<FinAccount>): FinAccount => ({
  id: "a1",
  profileId: "p-pj",
  name: "Conta Empresa",
  scope: "pj",
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
  balanceCents: 100_000,
  projectedCents: 100_000,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listProfiles.mockResolvedValue(PROFILES);
  api.listAccounts.mockResolvedValue([
    account({}),
    account({ id: "c1", name: "Cartão", kind: "cartao" }),
  ]);
  api.listClientLinks.mockResolvedValue([]);
});

const open = (canManage = true) =>
  renderApp(<ClientReceivingAccount clientId="cl1" canManage={canManage} />, { user: ADMIN });

describe("Conta de recebimento do cliente", () => {
  it("não aparece para quem não é o proprietário (Financeiro responde 403)", async () => {
    api.listClientLinks.mockRejectedValue(new Error("403"));
    open();
    await waitFor(() => expect(api.listClientLinks).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Recebimento no Financeiro")).toBeNull();
  });

  it("vincula uma conta (sem cartão na lista) e mostra o resultado", async () => {
    api.setClientLink.mockResolvedValue({
      link: { clientId: "cl1", profileId: "p-pj", accountId: "a1", categoryId: null },
      created: 3,
      updated: 0,
      removed: 0,
      skippedClosed: 0,
    });
    open();
    const select = (await screen.findByLabelText("Conta de recebimento")) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([
      "Sem vínculo",
      expect.stringContaining("Conta Empresa"),
    ]);
    fireEvent.change(select, { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular conta" }));
    await waitFor(() => expect(api.setClientLink).toHaveBeenCalledWith("cl1", "a1"));
    expect(await screen.findByRole("button", { name: "Trocar conta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desvincular" })).toBeTruthy();
  });

  it("desvincula e quem não gerencia só vê (sem botões)", async () => {
    api.listClientLinks.mockResolvedValue([
      { clientId: "cl1", profileId: "p-pj", accountId: "a1", categoryId: null },
    ]);
    api.removeClientLink.mockResolvedValue(2);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Desvincular" }));
    await waitFor(() => expect(api.removeClientLink).toHaveBeenCalledWith("cl1"));
    cleanup();
    open(false);
    await screen.findByLabelText("Conta de recebimento");
    expect(screen.queryByRole("button", { name: "Vincular conta" })).toBeNull();
  });
});
