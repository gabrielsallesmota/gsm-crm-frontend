// Clientes para todos os tenants (Fase 1) — contratos com renovação, parcelas por contrato e o
// "Criar cliente?" ao ganhar um lead, com os componentes REAIS (jsdom). Os serviços são
// substituídos: nada aqui chama rede. Papéis: todos veem; só admin/gestor alteram dinheiro.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/ClientsService", () => ({
  clientsService: {
    listContracts: vi.fn(),
    createContract: vi.fn(),
    updateContract: vi.fn(),
    endContract: vi.fn(),
    deleteContract: vi.fn(),
    listInstallments: vi.fn(),
    markInstallmentPaid: vi.fn(),
    markInstallmentUnpaid: vi.fn(),
    generateInstallments: vi.fn(),
    createCustomInstallmentPlan: vi.fn(),
    updateInstallment: vi.fn(),
    findByLead: vi.fn(),
    createFromLead: vi.fn(),
  },
}));
vi.mock("../../src/services/AutomationsService", () => ({
  automationsService: { list: vi.fn(), update: vi.fn() },
}));

import { ContractsSection } from "../../src/components/clients/ContractsSection";
import { CreateClientFromLeadDialog } from "../../src/components/clients/CreateClientFromLeadDialog";
import { automationsService } from "../../src/services/AutomationsService";
import { clientsService } from "../../src/services/ClientsService";
import type { Client, ClientContract, ClientInstallment } from "../../src/types/client";
import { toAutomationRules } from "../../src/utils/automations";
import { ADMIN, GESTOR, VENDEDOR, makeLead, renderApp } from "./support/harness";

const clients = vi.mocked(clientsService);
const automations = vi.mocked(automationsService);

afterEach(cleanup);

function contract(overrides: Partial<ClientContract> = {}): ClientContract {
  return {
    id: "k1",
    clientId: "c1",
    title: "Consórcio 2026",
    valueCents: 1_200_000,
    paymentType: "mensal",
    installmentCount: 12,
    startDate: "2026-01-10",
    endDate: null,
    renewalDate: "2031-06-20",
    renewalAlertMode: null,
    renewalAlertValue: null,
    status: "active",
    cycleNumber: 1,
    previousContractId: null,
    notes: "",
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-01-10T00:00:00Z",
    ...overrides,
  };
}

function installment(overrides: Partial<ClientInstallment> = {}): ClientInstallment {
  return {
    id: "i1",
    clientId: "c1",
    contractId: "k1",
    sequence: 1,
    dueDate: "2099-02-10",
    amountCents: 100_000,
    paidAt: null,
    status: "pendente",
    ...overrides,
  };
}

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    companyName: "Clínica Sol",
    phone: "",
    email: "",
    city: "",
    niche: "",
    source: "lead",
    sourceId: "l1",
    closedAt: "2026-01-10",
    paymentType: null,
    totalValueCents: null,
    installmentCount: null,
    contractFileName: null,
    contractUploadedAt: null,
    notes: "",
    ownerId: null,
    nextDueDate: null,
    hasOverdueInstallment: false,
    contractsCount: 0,
    nextRenewalDate: null,
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-01-10T00:00:00Z",
    ...overrides,
  };
}

const RENEWAL_RULE = toAutomationRules({
  items: [
    {
      key: "renewal",
      enabled: true,
      params: { alert_mode: 1, alert_value: 15 },
      limits: {
        alert_mode: { minimum: 0, maximum: 2, default: 0 },
        alert_value: { minimum: 0, maximum: 365, default: 0 },
      },
      version: 1,
      persisted: true,
      updated_at: null,
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  clients.listContracts.mockResolvedValue([contract()]);
  clients.listInstallments.mockResolvedValue([installment()]);
  clients.findByLead.mockResolvedValue(null);
  automations.list.mockResolvedValue(RENEWAL_RULE);
});

function section(canManage: boolean, user = ADMIN) {
  return renderApp(<ContractsSection clientId="c1" canManage={canManage} onChanged={() => undefined} />, {
    user,
  });
}

describe("ContractsSection — papéis", () => {
  it("todos veem os contratos e a data de renovação; vendedor não vê nenhuma ação de dinheiro", async () => {
    section(false, VENDEDOR);
    expect(await screen.findByRole("heading", { name: "Consórcio 2026" })).toBeTruthy();
    expect(screen.getByText("20/06/2031")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Novo contrato/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar contrato/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Encerrar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
  });

  it("vendedor vê as parcelas mas não consegue marcar pago nem editar", async () => {
    section(false, VENDEDOR);
    fireEvent.click(await screen.findByRole("button", { name: /Ver parcelas/ }));
    expect(await screen.findByText("10/02/2099")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Marcar pago/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Definir pagamento|Refazer parcelas/ })).toBeNull();
  });

  it("gestor marca a parcela como paga", async () => {
    clients.markInstallmentPaid.mockResolvedValue(installment({ paidAt: "2099-02-10", status: "pago" }));
    section(true, GESTOR);
    fireEvent.click(await screen.findByRole("button", { name: /Ver parcelas/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Marcar pago/ }));
    await waitFor(() => expect(clients.markInstallmentPaid).toHaveBeenCalledTimes(1));
    expect(clients.markInstallmentPaid.mock.calls[0]?.slice(0, 2)).toEqual(["c1", "i1"]);
  });

  it("mostra o vazio com orientação diferente para quem gerencia e para quem não", async () => {
    clients.listContracts.mockResolvedValue([]);
    section(true, ADMIN);
    expect(await screen.findByText(/Crie o primeiro para registrar valor/)).toBeTruthy();
    cleanup();
    section(false, VENDEDOR);
    expect(await screen.findByText(/Quem gerencia os clientes pode cadastrá-lo/)).toBeTruthy();
  });
});

describe("Novo contrato — renovação e aviso", () => {
  it("avisa quando a tarefa de renovação vai aparecer, pelo padrão da empresa", async () => {
    clients.listContracts.mockResolvedValue([]);
    section(true, ADMIN);
    fireEvent.click(await screen.findByRole("button", { name: /Novo contrato/ }));
    fireEvent.change(screen.getByLabelText("Data de renovação"), { target: { value: "2031-06-20" } });
    // padrão da empresa = 15 dias antes → 05/06/2031
    expect(
      await screen.findByText(/Padrão da empresa: 15 dias antes — a tarefa aparece em 05\/06\/2031/),
    ).toBeTruthy();
  });

  it("regra própria do contrato sobrepõe o padrão", async () => {
    clients.listContracts.mockResolvedValue([]);
    section(true, ADMIN);
    fireEvent.click(await screen.findByRole("button", { name: /Novo contrato/ }));
    fireEvent.change(screen.getByLabelText("Data de renovação"), { target: { value: "2031-06-20" } });
    fireEvent.change(screen.getByLabelText("Quando avisar sobre a renovação"), {
      target: { value: "month_start" },
    });
    expect(
      await screen.findByText(/No 1º dia do mês da renovação — a tarefa aparece em 01\/06\/2031/),
    ).toBeTruthy();
  });

  it("recusa renovação antes do início e bloqueia o envio", async () => {
    clients.listContracts.mockResolvedValue([]);
    section(true, ADMIN);
    fireEvent.click(await screen.findByRole("button", { name: /Novo contrato/ }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-05-01" } });
    fireEvent.change(screen.getByLabelText("Data de renovação"), { target: { value: "2026-04-01" } });
    expect(await screen.findByText(/renovação não pode ser antes/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Criar contrato" }) as HTMLButtonElement).disabled).toBe(true);
    expect(clients.createContract).not.toHaveBeenCalled();
  });

  it("envia datas e regra de aviso ao criar", async () => {
    clients.listContracts.mockResolvedValue([]);
    clients.createContract.mockResolvedValue(contract());
    section(true, ADMIN);
    fireEvent.click(await screen.findByRole("button", { name: /Novo contrato/ }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-01-10" } });
    fireEvent.change(screen.getByLabelText("Data de renovação"), { target: { value: "2027-01-10" } });
    fireEvent.change(screen.getByLabelText("Quando avisar sobre a renovação"), {
      target: { value: "months_before" },
    });
    fireEvent.change(screen.getByLabelText("Meses de antecedência"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar contrato" }));
    await waitFor(() => expect(clients.createContract).toHaveBeenCalledTimes(1));
    const [clientId, input] = clients.createContract.mock.calls[0]!;
    expect(clientId).toBe("c1");
    expect(input).toMatchObject({
      startDate: "2026-01-10",
      renewalDate: "2027-01-10",
      renewalAlertMode: "months_before",
      renewalAlertValue: 2,
    });
  });
});

describe("Criar cliente a partir do lead ganho", () => {
  const lead = makeLead({ id: "l9", name: "Maria Souza", company: "Clínica Sol", value: 2500 });

  it("gestor: formulário vem com o valor do lead e envia contrato com renovação", async () => {
    clients.createFromLead.mockResolvedValue({ client: client({ id: "c9" }), created: true });
    renderApp(<CreateClientFromLeadDialog lead={lead} onClose={() => undefined} />, { user: GESTOR });
    expect(await screen.findByRole("heading", { name: "Criar cliente?" })).toBeTruthy();
    expect((screen.getByLabelText("Valor do contrato") as HTMLInputElement).value).toMatch(/2\.500,00/);
    fireEvent.change(screen.getByLabelText("Data de fechamento"), { target: { value: "2026-10-18" } });
    fireEvent.change(screen.getByLabelText("Data de renovação (opcional)"), {
      target: { value: "2027-10-18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar cliente" }));
    await waitFor(() => expect(clients.createFromLead).toHaveBeenCalledTimes(1));
    expect(clients.createFromLead.mock.calls[0]![0]).toMatchObject({
      leadId: "l9",
      closedAt: "2026-10-18",
      contract: { startDate: "2026-10-18", valueCents: 250000, renewalDate: "2027-10-18" },
    });
    expect(await screen.findByRole("heading", { name: "Cliente criado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir ficha do cliente" })).toBeTruthy();
  });

  it("vendedor: sem campos de contrato, e a chamada não leva contrato", async () => {
    clients.createFromLead.mockResolvedValue({ client: client({ id: "c9" }), created: true });
    renderApp(<CreateClientFromLeadDialog lead={lead} onClose={() => undefined} />, {
      user: VENDEDOR,
    });
    expect(await screen.findByRole("heading", { name: "Criar cliente?" })).toBeTruthy();
    expect(screen.queryByLabelText("Valor do contrato")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Criar cliente" }));
    await waitFor(() => expect(clients.createFromLead).toHaveBeenCalledTimes(1));
    expect(clients.createFromLead.mock.calls[0]![0]).not.toHaveProperty("contract");
  });

  it("lead que já é cliente: oferece 'Ver cliente' e não cria de novo", async () => {
    clients.findByLead.mockResolvedValue(client({ id: "c1", companyName: "Clínica Sol" }));
    renderApp(<CreateClientFromLeadDialog lead={lead} onClose={() => undefined} />, { user: ADMIN });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/já é cliente/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Ver cliente" })).toBeTruthy();
    expect(clients.createFromLead).not.toHaveBeenCalled();
  });

  it("'Agora não' fecha sem criar nada", async () => {
    const onClose = vi.fn();
    renderApp(<CreateClientFromLeadDialog lead={lead} onClose={onClose} />, { user: GESTOR });
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(clients.createFromLead).not.toHaveBeenCalled();
  });
});
