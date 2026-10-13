// CRM-003C — tela Automações comerciais com os componentes REAIS (jsdom). Os serviços de API
// são substituídos: nada aqui chama rede, n8n ou WhatsApp, e nenhum teste espera envio.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/AutomationsService", () => ({
  automationsService: { list: vi.fn(), update: vi.fn() },
}));
vi.mock("../../src/services/NotificationsService", () => ({
  notificationsService: { getSettings: vi.fn(), updateSettings: vi.fn() },
}));

import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { AutomationsPage } from "../../src/pages/AutomationsPage";
import { automationsService } from "../../src/services/AutomationsService";
import { notificationsService } from "../../src/services/NotificationsService";
import type { AuthUser } from "../../src/types/auth";
import { ApiError } from "../../src/types/common";
import { toAutomationRules } from "../../src/utils/automations";
import { toSettings } from "../../src/utils/notifications";

const automations = vi.mocked(automationsService);
const notifications = vi.mocked(notificationsService);

afterEach(cleanup);

const RULES = {
  items: [
    {
      key: "follow_up",
      enabled: false,
      params: { days_without_activity: 3, due_in_days: 1 },
      limits: {
        days_without_activity: { minimum: 1, maximum: 90, default: 3 },
        due_in_days: { minimum: 0, maximum: 14, default: 1 },
      },
      version: 0,
      persisted: false,
      updated_at: null,
    },
    {
      key: "overdue_task",
      enabled: true,
      params: { grace_minutes: 60 },
      limits: { grace_minutes: { minimum: 0, maximum: 1440, default: 60 } },
      version: 2,
      persisted: true,
      updated_at: "2026-10-13T12:00:00Z",
    },
    {
      key: "stalled_opportunity",
      enabled: false,
      params: { days_in_stage: 14 },
      limits: { days_in_stage: { minimum: 1, maximum: 365, default: 14 } },
      version: 0,
      persisted: false,
      updated_at: null,
    },
  ],
};

const POLICY = {
  enabled: true,
  channel: "whatsapp",
  schedule: { frequency: "daily", time: "08:00", timezone: null, include_weekends: true },
  recipient: { roles: ["admin"], scope: "team" },
  content: {
    tasks: { mode: "list", max_items: 5 },
    leads: { mode: "list", max_items: 5 },
    include_overdue: true,
    calendar: { enabled: true, max_items: 5 },
    opportunities: { enabled: false, max_items: 5 },
  },
  triggers: { new_lead: { enabled: true } },
};

const settings = (policy: Record<string, unknown> = POLICY, version = 4) =>
  toSettings({
    version,
    persisted: true,
    updated_at: "2026-10-12T12:00:00Z",
    tenant_timezone: "America/Sao_Paulo",
    policy,
    roles: {},
    effective: null,
  });

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "a@example.com",
    name: "Ana",
    role: "admin",
    mustChangePassword: false,
    accountId: "acc",
    tenantId: "t1",
    isPlatformStaff: false,
    features: { notifications: true },
    ...overrides,
  };
}

function renderAs(principal: AuthUser, ui: ReactNode) {
  const value = { user: principal, loading: false } as unknown as AuthContextValue;
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  automations.list.mockResolvedValue(toAutomationRules(RULES));
  notifications.getSettings.mockResolvedValue(settings());
});

function card(name: RegExp) {
  return screen.getByRole("heading", { name }).closest("li") as HTMLElement;
}

describe("AutomationsPage", () => {
  it("mostra as cinco automações e deixa claro que nada vai para o cliente", async () => {
    renderAs(user(), <AutomationsPage />);
    expect(await screen.findByRole("heading", { name: /Follow-up automático/ })).toBeTruthy();
    for (const title of [
      /Novo lead/,
      /Follow-up automático/,
      /Tarefa atrasada/,
      /Resumo diário/,
      /Oportunidade parada/,
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    }
    expect(screen.getByText(/Nenhuma delas envia mensagem para o cliente/)).toBeTruthy();
    expect(screen.getAllByText("Central de Notificações")).toHaveLength(2); // as 2 reaproveitadas
  });

  it("admin liga o follow-up, ajusta os dias e salva só o que mudou, com a versão lida", async () => {
    automations.update.mockResolvedValue(
      toAutomationRules({
        items: [
          {
            ...RULES.items[0],
            enabled: true,
            version: 1,
            persisted: true,
            params: { days_without_activity: 7, due_in_days: 1 },
          },
        ],
      })[0]!,
    );
    renderAs(user(), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Follow-up automático/ });
    const followUp = card(/Follow-up automático/);
    fireEvent.click(
      within(followUp).getByRole("checkbox", { name: "Ativar Follow-up automático" }),
    );
    fireEvent.change(within(followUp).getByLabelText("Dias sem movimentação"), {
      target: { value: "7" },
    });
    fireEvent.click(within(followUp).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(automations.update).toHaveBeenCalledTimes(1));
    expect(automations.update).toHaveBeenCalledWith("follow_up", {
      version: 0,
      enabled: true,
      params: { days_without_activity: 7 },
    });
    expect(await within(card(/Follow-up automático/)).findByText("Regra salva.")).toBeTruthy();
  });

  it("não deixa salvar valor fora do limite e explica o intervalo", async () => {
    renderAs(user(), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Follow-up automático/ });
    const followUp = card(/Follow-up automático/);
    fireEvent.change(within(followUp).getByLabelText("Dias sem movimentação"), {
      target: { value: "120" },
    });
    expect((await within(followUp).findByRole("alert")).textContent).toMatch(/entre 1 e 90/);
    expect(
      (within(followUp).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(automations.update).not.toHaveBeenCalled();
  });

  it("409 não sobrescreve: avisa e oferece recarregar", async () => {
    automations.update.mockRejectedValue(new ApiError(409, "conflito"));
    renderAs(user(), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Tarefa atrasada/ });
    const overdue = card(/Tarefa atrasada/);
    fireEvent.change(within(overdue).getByLabelText("Tolerância após o vencimento"), {
      target: { value: "30" },
    });
    fireEvent.click(within(overdue).getByRole("button", { name: "Salvar" }));
    expect((await within(overdue).findByRole("alert")).textContent).toMatch(/NÃO foram salvas/);
    fireEvent.click(within(overdue).getByRole("button", { name: "Recarregar configurações" }));
    await waitFor(() => expect(automations.list).toHaveBeenCalledTimes(2));
  });

  it("gestor só consulta: campos travados e sem botão de salvar", async () => {
    renderAs(user({ role: "gestor" }), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Follow-up automático/ });
    expect(screen.getByText(/Somente o administrador altera as automações/)).toBeTruthy();
    const followUp = card(/Follow-up automático/);
    expect(
      (within(followUp).getByRole("checkbox", { name: /Ativar/ }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("sessão de suporte da GSM é só leitura, mesmo sendo admin do cliente", async () => {
    renderAs(
      user({
        impersonation: {
          sessionId: "s",
          tenantId: "t1",
          tenantName: "Cliente",
          mode: "read_only",
        } as never,
      }),
      <AutomationsPage />,
    );
    await screen.findByRole("heading", { name: /Follow-up automático/ });
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("resumo diário e novo lead usam a MESMA API de Notificações (sem segunda fonte)", async () => {
    notifications.updateSettings.mockResolvedValue(
      settings({ ...POLICY, triggers: { new_lead: { enabled: false } } }, 5),
    );
    renderAs(user(), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Novo lead/ });
    const newLead = card(/Novo lead/);
    fireEvent.click(within(newLead).getByRole("checkbox", { name: "Ativar Novo lead" }));
    fireEvent.click(within(newLead).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(notifications.updateSettings).toHaveBeenCalledTimes(1));
    expect(notifications.updateSettings).toHaveBeenCalledWith({
      version: 4,
      policy: { triggers: { new_lead: { enabled: false } } },
    });
    expect(automations.update).not.toHaveBeenCalled();
  });

  it("avisa que desligar o resumo pausa todas as notificações", async () => {
    renderAs(user(), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Resumo diário/ });
    expect(within(card(/Resumo diário/)).getByText(/pausa TODAS as notificações/)).toBeTruthy();
  });

  it("sem a Central de Notificações contratada, as duas reaproveitadas ficam indisponíveis", async () => {
    renderAs(user({ features: { notifications: false } }), <AutomationsPage />);
    await screen.findByRole("heading", { name: /Follow-up automático/ });
    expect(notifications.getSettings).not.toHaveBeenCalled();
    expect(within(card(/Novo lead/)).getByText(/Indisponível/)).toBeTruthy();
    expect(within(card(/Resumo diário/)).queryByRole("checkbox")).toBeNull();
    // as três regras próprias continuam funcionando
    expect(
      (within(card(/Follow-up automático/)).getByRole("checkbox") as HTMLInputElement).disabled,
    ).toBe(false);
  });

  it("erro 403 do servidor mostra 'sem acesso', não uma tela quebrada", async () => {
    automations.list.mockRejectedValue(new ApiError(403, "Acesso negado"));
    renderAs(user(), <AutomationsPage />);
    expect(await screen.findByText("Sem acesso")).toBeTruthy();
  });
});
