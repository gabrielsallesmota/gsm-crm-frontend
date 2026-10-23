// CRM-003B.3 — Central de Notificações com os componentes REAIS renderizados
// (jsdom). O serviço de API é substituído: nada aqui chama rede, n8n ou
// WhatsApp, e nenhum teste espera envio de mensagem.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/NotificationsService", () => ({
  notificationsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getMyPreferences: vi.fn(),
    updateMyPreferences: vi.fn(),
    listRecipients: vi.fn(),
    preview: vi.fn(),
    listDeliveries: vi.fn(),
  },
}));

import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { CompanyPolicyPanel } from "../../src/components/notifications/CompanyPolicyPanel";
import { DeliveriesPanel } from "../../src/components/notifications/DeliveriesPanel";
import { PersonalPreferencesPanel } from "../../src/components/notifications/PersonalPreferencesPanel";
import { PreviewPanel } from "../../src/components/notifications/PreviewPanel";
import { RecipientsPanel } from "../../src/components/notifications/RecipientsPanel";
import { RoleOverridesPanel } from "../../src/components/notifications/RoleOverridesPanel";
import { WhatsappContactPanel } from "../../src/components/notifications/WhatsappContactPanel";
import { MyNotificationsPage } from "../../src/pages/MyNotificationsPage";
import { NotificationsSettingsPage } from "../../src/pages/NotificationsSettingsPage";
import { RequireFeature, RequirePermission } from "../../src/routes/RequirePermission";
import { notificationsService } from "../../src/services/NotificationsService";
import type { AuthUser } from "../../src/types/auth";
import { ApiError } from "../../src/types/common";
import {
  toDelivery,
  toPreferences,
  toPreview,
  toRecipient,
  toSettings,
} from "../../src/utils/notifications";

const api = vi.mocked(notificationsService);

afterEach(cleanup);

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

function effective(overrides: Record<string, unknown> = {}) {
  return {
    receives: true,
    not_receiving_reason: null,
    timezone: "America/Sao_Paulo",
    timezone_source: "tenant",
    restricted_fields: [],
    policy: POLICY,
    ...overrides,
  };
}

const settings = (extra: Record<string, unknown> = {}) =>
  toSettings({
    version: 4,
    persisted: true,
    updated_at: "2026-10-12T12:00:00Z",
    tenant_timezone: "America/Sao_Paulo",
    policy: POLICY,
    roles: {},
    effective: effective(),
    ...extra,
  });

const prefs = (extra: Record<string, unknown> = {}, whatsapp: Record<string, unknown> = {}) =>
  toPreferences({
    version: 2,
    persisted: true,
    preferences: {},
    timezone: null,
    whatsapp: {
      phone: null,
      enabled: true,
      consent: false,
      consent_at: null,
      consent_revoked_at: null,
      verified: false,
      status: "no_phone",
      ...whatsapp,
    },
    effective: effective(),
    ...extra,
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

function renderAs(principal: AuthUser | null, ui: ReactNode) {
  const value = { user: principal, loading: false } as unknown as AuthContextValue;
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks(); // o histórico de chamadas não pode vazar entre testes
  api.preview.mockResolvedValue(
    toPreview({
      recipient_user_id: "u1",
      recipient_name: "Ana",
      local_date: "2026-10-12",
      timezone: "America/Sao_Paulo",
      scope: "team",
      receives: true,
      not_receiving_reason: null,
      empty: false,
      sections: [
        {
          key: "tasks",
          mode: "list",
          total: 7,
          counts: { overdue: 7 },
          items: [
            {
              id: "t1",
              title: "Ligar para Maria",
              lead_name: "Maria",
              due_local: "11/10 09:00",
              category: "overdue",
            },
          ],
          truncated: 6,
        },
      ],
      text: "*Resumo do dia — 12/10/2026*",
      channel: { name: "whatsapp", available: false, status: "no_phone" },
      delivered: false,
    }),
  );
});

// ---- política da empresa ---------------------------------------------------------

describe("CompanyPolicyPanel", () => {
  const renderPanel = (canEdit = true, current = settings()) => {
    const onSaved = vi.fn();
    const onReload = vi.fn();
    render(
      <CompanyPolicyPanel
        settings={current}
        canEdit={canEdit}
        onSaved={onSaved}
        onReload={onReload}
      />,
    );
    return { onSaved, onReload };
  };

  it("mostra o padrão aprovado e só salva por ação explícita", () => {
    renderPanel();
    expect((screen.getByLabelText("Horário (diário)") as HTMLInputElement).value).toBe("08:00");
    const save = screen.getByRole("button", { name: "Salvar política" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Horário (diário)"), { target: { value: "07:30" } });
    expect(api.updateSettings).not.toHaveBeenCalled(); // navegar pelos campos não grava
    expect(save.disabled).toBe(false);
  });

  it("envia PATCH parcial com a versão lida", async () => {
    api.updateSettings.mockResolvedValue(
      settings({
        version: 5,
        policy: { ...POLICY, schedule: { ...POLICY.schedule, time: "07:30" } },
      }),
    );
    const { onSaved } = renderPanel();
    fireEvent.change(screen.getByLabelText("Horário (diário)"), { target: { value: "07:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.updateSettings).toHaveBeenCalledWith({
      version: 4,
      policy: { schedule: { time: "07:30" } },
    });
    expect(screen.getByText("Política salva.")).toBeTruthy();
  });

  it("409: avisa que outra sessão alterou e oferece recarregar, sem sobrescrever", async () => {
    api.updateSettings.mockRejectedValue(new ApiError(409, "As configurações foram alteradas"));
    const { onSaved, onReload } = renderPanel();
    fireEvent.change(screen.getByLabelText("Horário (diário)"), { target: { value: "07:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    expect(await screen.findByText(/alteradas em outra sessão/)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar configurações" }));
    expect(onReload).toHaveBeenCalled();
    expect(api.updateSettings).toHaveBeenCalledTimes(1); // nenhuma segunda tentativa automática
  });

  it("422: mostra a mensagem de validação do backend", async () => {
    api.updateSettings.mockRejectedValue(new ApiError(422, "Horário inválido: use HH:MM"));
    renderPanel();
    fireEvent.change(screen.getByLabelText("Horário (diário)"), { target: { value: "07:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Horário inválido");
  });

  it("gestor consulta: campos desabilitados e nenhum botão de salvar", () => {
    renderPanel(false);
    expect(screen.queryByRole("button", { name: "Salvar política" })).toBeNull();
    // <fieldset disabled> desabilita os campos filhos (não é a propriedade do input)
    expect(screen.getByLabelText("Horário (diário)").matches(":disabled")).toBe(true);
    expect(screen.getByText(/Somente o administrador altera/)).toBeTruthy();
  });

  it("empresa sem configuração salva usa o padrão e avisa que nada foi gravado", () => {
    renderPanel(true, settings({ version: 0, persisted: false }));
    expect(screen.getByText(/ainda usa o padrão aprovado/)).toBeTruthy();
  });

  it("avisa quando nenhum perfil está marcado como destinatário", () => {
    renderPanel(true, settings({ policy: { ...POLICY, recipient: { roles: [], scope: "team" } } }));
    expect(screen.getByText(/ninguém receberá o resumo/)).toBeTruthy();
  });

  it("o canal aparece como WhatsApp indisponível — não há seletor de e-mail", () => {
    renderPanel();
    expect(screen.getByText(/WhatsApp \(disponível em breve\)/)).toBeTruthy();
    expect(screen.queryByText(/e-mail/i)).toBeNull();
  });
});

describe("RoleOverridesPanel", () => {
  it("vendedor não oferece escopo de equipe e salva só o ajuste do perfil", async () => {
    api.updateSettings.mockResolvedValue(settings({ version: 5 }));
    const onSaved = vi.fn();
    render(
      <RoleOverridesPanel settings={settings()} canEdit onSaved={onSaved} onReload={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Vendedor/ }));
    expect((screen.getByLabelText("Dados incluídos") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Personalizar para Vendedor/));
    fireEvent.change(screen.getByLabelText("Horário (diário)"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ajuste de Vendedor/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = api.updateSettings.mock.calls[0]?.[0];
    expect(call?.version).toBe(4);
    // esparso: só o que diverge da empresa; vendedor nunca recebe escopo TEAM
    expect(call?.roles).toEqual({ vendedor: { schedule: { time: "09:00" } } });
  });

  it("salvar fica desabilitado enquanto o perfil não diverge da empresa", () => {
    render(
      <RoleOverridesPanel settings={settings()} canEdit onSaved={vi.fn()} onReload={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(/Personalizar para Gestor/));
    expect(
      (screen.getByRole("button", { name: /Salvar ajuste de Gestor/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("desmarcar 'personalizar' remove o ajuste do perfil", async () => {
    api.updateSettings.mockResolvedValue(settings({ version: 5 }));
    const withOverride = settings({ roles: { gestor: { content: { leads: { mode: "count" } } } } });
    render(
      <RoleOverridesPanel settings={withOverride} canEdit onSaved={vi.fn()} onReload={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(/Personalizar para Gestor/));
    fireEvent.click(screen.getByRole("button", { name: /Salvar ajuste de Gestor/ }));
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
    expect(api.updateSettings).toHaveBeenCalledWith({ version: 4, roles: { gestor: null } });
  });

  it("gestor só visualiza", () => {
    render(
      <RoleOverridesPanel
        settings={settings()}
        canEdit={false}
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Salvar ajuste/ })).toBeNull();
  });
});

// ---- telefone e consentimento ------------------------------------------------------

/** Como a página real: o que o "Salvar" devolve vira o novo estado da tela. */
function StatefulWhatsapp({ initial }: { initial: ReturnType<typeof prefs> }) {
  const [current, setCurrent] = useState(initial);
  return (
    <WhatsappContactPanel
      prefs={current}
      disabled={false}
      onSaved={setCurrent}
      onReload={vi.fn()}
    />
  );
}

describe("WhatsappContactPanel", () => {
  const renderPanel = (current = prefs(), disabled = false) => {
    const onSaved = vi.fn();
    render(
      <WhatsappContactPanel
        prefs={current}
        disabled={disabled}
        onSaved={onSaved}
        onReload={vi.fn()}
      />,
    );
    return { onSaved };
  };

  it("o consentimento nunca vem pré-marcado e o número nunca vem verificado", () => {
    renderPanel();
    const agree = screen.getByRole("checkbox") as HTMLInputElement;
    expect(agree.checked).toBe(false);
    expect(screen.getByText(/Número: não verificado/)).toBeTruthy();
    expect(screen.getByText(/WhatsApp ainda não está disponível/)).toBeTruthy();
  });

  it("telefone inválido é recusado no cliente, sem chamar a API", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Telefone (o mesmo do seu cadastro)"), {
      target: { value: "987654321" }, // sem DDD (mesma regra do cadastro)
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar telefone" }));
    expect(screen.getByRole("alert").textContent).toContain("Telefone inválido");
    expect(api.updateMyPreferences).not.toHaveBeenCalled();
  });

  it("telefone + autorização explícita: envia consent só quando a caixa é marcada", async () => {
    api.updateMyPreferences.mockResolvedValue(
      prefs(
        { version: 3 },
        {
          phone: "+5511987654321",
          consent: true,
          consent_at: "2026-10-12T12:00:00Z",
          status: "channel_unavailable",
        },
      ),
    );
    const { onSaved } = renderPanel();
    fireEvent.change(screen.getByLabelText("Telefone (o mesmo do seu cadastro)"), {
      target: { value: "+55 (11) 98765-4321" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar telefone" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.updateMyPreferences).toHaveBeenCalledWith({
      version: 2,
      whatsapp: { phone: "+5511987654321", consent: true },
    });
    expect(screen.getByText("Telefone e autorização salvos.")).toBeTruthy();
  });

  it("só o telefone: não envia consentimento", async () => {
    api.updateMyPreferences.mockResolvedValue(
      prefs({ version: 3 }, { phone: "+5511987654321", status: "no_consent" }),
    );
    renderPanel();
    fireEvent.change(screen.getByLabelText("Telefone (o mesmo do seu cadastro)"), {
      target: { value: "+5511987654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar telefone" }));
    await waitFor(() => expect(api.updateMyPreferences).toHaveBeenCalled());
    expect(api.updateMyPreferences).toHaveBeenCalledWith({
      version: 2,
      whatsapp: { phone: "+5511987654321" },
    });
  });

  it("revogar autorização", async () => {
    const granted = prefs(
      {},
      {
        phone: "+5511987654321",
        consent: true,
        consent_at: "2026-10-12T12:00:00Z",
        status: "channel_unavailable",
      },
    );
    api.updateMyPreferences.mockResolvedValue(
      prefs(
        { version: 3 },
        {
          phone: "+5511987654321",
          consent_revoked_at: "2026-10-12T13:00:00Z",
          status: "no_consent",
        },
      ),
    );
    renderPanel(granted);
    fireEvent.click(screen.getByRole("button", { name: "Revogar autorização" }));
    await waitFor(() => expect(api.updateMyPreferences).toHaveBeenCalled());
    expect(api.updateMyPreferences).toHaveBeenCalledWith({
      version: 2,
      whatsapp: { consent: false },
    });
    expect(await screen.findByText("Autorização revogada.")).toBeTruthy();
  });

  it("trocar o telefone avisa que autorização e verificação deixam de valer", async () => {
    const granted = prefs(
      {},
      {
        phone: "+5511987654321",
        consent: true,
        consent_at: "2026-10-12T12:00:00Z",
        status: "channel_unavailable",
      },
    );
    api.updateMyPreferences.mockResolvedValue(
      prefs({ version: 3 }, { phone: "+5521912345678", consent: false, status: "no_consent" }),
    );
    render(<StatefulWhatsapp initial={granted} />);
    fireEvent.change(screen.getByLabelText("Telefone (o mesmo do seu cadastro)"), {
      target: { value: "+5521912345678" },
    });
    expect(screen.getByRole("alert").textContent).toContain("deixam de valer");
    fireEvent.click(screen.getByRole("button", { name: "Salvar telefone" }));
    await waitFor(() => expect(api.updateMyPreferences).toHaveBeenCalled());
    expect(api.updateMyPreferences).toHaveBeenCalledWith({
      version: 2,
      whatsapp: { phone: "+5521912345678" },
    });
    // a interface passa a refletir o estado devolvido: sem autorização
    expect(await screen.findByText(/Autorização: não concedida/)).toBeTruthy();
  });

  it("sessão de suporte: tudo desabilitado", () => {
    renderPanel(prefs(), true);
    expect((screen.getByLabelText("Telefone (o mesmo do seu cadastro)") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });
});

// ---- preferências pessoais ----------------------------------------------------------

describe("PersonalPreferencesPanel", () => {
  it("mostra o que a empresa bloqueia e as restrições devolvidas pelo backend", () => {
    const company = settings();
    const mine = prefs({
      effective: effective({
        restricted_fields: ["tasks_max_items", "opportunities_enabled"],
      }),
    });
    render(
      <PersonalPreferencesPanel
        settings={company}
        prefs={mine}
        role="gestor"
        canEdit
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(screen.getByText(/foram ignorados: Quantidade de tarefas, Oportunidades/)).toBeTruthy();
    const opportunities = screen.getByLabelText(/Oportunidades/) as HTMLInputElement;
    expect(opportunities.checked).toBe(false);
    expect(opportunities.disabled).toBe(true); // a empresa desligou: não dá para prometer
    expect(screen.getAllByText(/A empresa não permite ativar isto/).length).toBeGreaterThan(0);
  });

  it("vendedor não oferece 'equipe inteira' e o limite de itens acompanha a empresa", () => {
    render(
      <PersonalPreferencesPanel
        settings={settings()}
        prefs={prefs()}
        role="vendedor"
        canEdit
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Dados incluídos") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/Vendedores sempre recebem só os próprios dados/)).toBeTruthy();
    expect(screen.getByLabelText("Tarefas").querySelectorAll("option").length).toBe(3);
  });

  it("empresa com tarefas em 'quantidade' não oferece 'lista'", () => {
    const company = settings({
      policy: { ...POLICY, content: { ...POLICY.content, tasks: { mode: "count", max_items: 3 } } },
    });
    render(
      <PersonalPreferencesPanel
        settings={company}
        prefs={prefs()}
        role="gestor"
        canEdit
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    const options = Array.from(screen.getByLabelText("Tarefas").querySelectorAll("option")).map(
      (o) => o.getAttribute("value"),
    );
    expect(options).toEqual(["count", "off"]);
  });

  it("salva só o que mudou e o fuso individual separado do tenant", async () => {
    api.updateMyPreferences.mockResolvedValue(prefs({ version: 3, timezone: "Europe/Lisbon" }));
    render(
      <PersonalPreferencesPanel
        settings={settings()}
        prefs={prefs()}
        role="admin"
        canEdit
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Fuso das suas notificações"), {
      target: { value: "Europe/Lisbon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
    await waitFor(() => expect(api.updateMyPreferences).toHaveBeenCalled());
    expect(api.updateMyPreferences).toHaveBeenCalledWith({ version: 2, timezone: "Europe/Lisbon" });
  });

  it("409 nas preferências oferece recarregar", async () => {
    api.updateMyPreferences.mockRejectedValue(
      new ApiError(409, "Suas preferências foram alteradas"),
    );
    const onReload = vi.fn();
    render(
      <PersonalPreferencesPanel
        settings={settings()}
        prefs={prefs()}
        role="admin"
        canEdit
        onSaved={vi.fn()}
        onReload={onReload}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Agenda do dia/));
    fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
    fireEvent.click(await screen.findByRole("button", { name: "Recarregar configurações" }));
    expect(onReload).toHaveBeenCalled();
  });

  it("explica por que hoje a pessoa não receberia o resumo", () => {
    const mine = prefs({
      effective: effective({ receives: false, not_receiving_reason: "role_not_recipient" }),
    });
    render(
      <PersonalPreferencesPanel
        settings={settings()}
        prefs={mine}
        role="vendedor"
        canEdit
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(screen.getByText(/seu perfil não está entre os destinatários/)).toBeTruthy();
  });
});

// ---- prévia ---------------------------------------------------------------------------

describe("PreviewPanel", () => {
  it("deixa claro que é prévia, não oferece envio e permite atualizar", async () => {
    render(<PreviewPanel />);
    expect(await screen.findByText(/Nenhuma mensagem será enviada/)).toBeTruthy();
    expect(screen.getByText("Tarefas (7)")).toBeTruthy();
    expect(screen.getByText(/Ligar para Maria/)).toBeTruthy();
    expect(screen.getByText(/e mais 6/)).toBeTruthy();
    expect(screen.getByLabelText("Texto da prévia").textContent).toContain("Resumo do dia");
    expect(screen.queryByRole("button", { name: /enviar/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar prévia" }));
    await waitFor(() => expect(api.preview).toHaveBeenCalledTimes(2));
  });

  it("item pessoal (sem lead) aparece sem o sufixo de lead", async () => {
    api.preview.mockResolvedValue(
      toPreview({
        recipient_name: "Ana",
        empty: false,
        sections: [
          {
            key: "tasks",
            mode: "list",
            total: 1,
            counts: { today: 1 },
            items: [
              {
                id: "t9",
                title: "Ligar para o contador",
                lead_name: null,
                due_local: "12/10 18:00",
                category: "today",
              },
            ],
            truncated: 0,
          },
          {
            key: "calendar",
            mode: "list",
            total: 1,
            counts: { today: 1 },
            items: [{ id: "e9", title: "Reunião pessoal", lead_name: null, time_local: "10:00" }],
            truncated: 0,
          },
        ],
        text: "*Resumo do dia*",
      }),
    );
    render(<PreviewPanel />);
    expect(await screen.findByText("Ligar para o contador (12/10 18:00)")).toBeTruthy();
    expect(screen.getByText("10:00 Reunião pessoal")).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it("sem dados mostra a ausência explicitamente", async () => {
    api.preview.mockResolvedValue(
      toPreview({
        recipient_name: "Ana",
        empty: true,
        sections: [],
        text: "Nada pendente para hoje.",
      }),
    );
    render(<PreviewPanel />);
    expect(
      await screen.findByText(/Nada pendente para hoje — o resumo ficaria vazio/),
    ).toBeTruthy();
  });

  it("erro da API aparece como alerta", async () => {
    api.preview.mockRejectedValue(
      new ApiError(403, "Só o administrador pré-visualiza o resumo de outra pessoa"),
    );
    render(<PreviewPanel />);
    expect((await screen.findByRole("alert")).textContent).toContain("Só o administrador");
  });

  it("admin escolhe outra pessoa", async () => {
    const onChange = vi.fn();
    render(
      <PreviewPanel
        recipientOptions={[{ userId: "u2", name: "Bia" }]}
        onRecipientChange={onChange}
      />,
    );
    await screen.findByText(/Nenhuma mensagem será enviada/);
    fireEvent.change(screen.getByLabelText("Pré-visualizar para"), { target: { value: "u2" } });
    expect(onChange).toHaveBeenCalledWith("u2");
  });
});

// ---- destinatários ----------------------------------------------------------------------

describe("RecipientsPanel", () => {
  const page = (items: unknown[], total = items.length) => ({
    items: items.map(toRecipient),
    total,
    page: 1,
    pageSize: 50,
  });
  const recipient = (extra: Record<string, unknown> = {}) => ({
    user_id: "u1",
    name: "Bia Vendedora",
    role: "vendedor",
    receives: false,
    not_receiving_reason: "role_not_recipient",
    scope: "self",
    timezone: "America/Sao_Paulo",
    whatsapp: { phone_masked: "+55•••••••••21", consent: false, verified: false, enabled: true },
    channel_status: "no_consent",
    ...extra,
  });

  it("mostra só o telefone mascarado, motivo e nenhuma edição", async () => {
    api.listRecipients.mockResolvedValue(page([recipient()]));
    render(<RecipientsPanel />);
    expect(await screen.findByText("Bia Vendedora")).toBeTruthy();
    expect(screen.getByText("+55•••••••••21")).toBeTruthy();
    expect(screen.getByText("Este perfil não está entre os destinatários")).toBeTruthy();
    expect(screen.getByText(/número não verificado/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("lista vazia, erro e paginação", async () => {
    api.listRecipients.mockResolvedValueOnce(page([]));
    const first = render(<RecipientsPanel />);
    expect(await screen.findByText("Nenhum membro ativo")).toBeTruthy();
    first.unmount();

    api.listRecipients.mockRejectedValueOnce(new ApiError(503, ""));
    const second = render(<RecipientsPanel />);
    expect(await screen.findByText(/temporariamente indisponível/)).toBeTruthy();
    second.unmount();

    api.listRecipients.mockResolvedValue({ ...page([recipient()], 120), pageSize: 50 });
    render(<RecipientsPanel />);
    expect(await screen.findByText("Página 1 de 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(api.listRecipients).toHaveBeenLastCalledWith(2));
  });
});

// ---- histórico ----------------------------------------------------------------------------

describe("DeliveriesPanel", () => {
  const delivery = (extra: Record<string, unknown> = {}) =>
    toDelivery({
      id: "d1",
      recipient_user_id: "u1",
      kind: "daily_digest",
      channel: "whatsapp",
      status: "skipped",
      status_reason: "no_phone",
      scheduled_for: "2026-10-12T11:00:00Z",
      local_date: "2026-10-12",
      item_count: null,
      expires_at: "2026-10-12T17:00:00Z",
      sent_at: null,
      created_at: "2026-10-12T11:00:05Z",
      ...extra,
    });

  it("nunca apresenta skipped/channel_unavailable como enviada e usa o fuso de quem vê", async () => {
    api.listDeliveries.mockResolvedValue({
      items: [
        delivery(),
        delivery({
          id: "d2",
          status: "channel_unavailable",
          status_reason: "whatsapp_not_integrated",
        }),
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });
    render(
      <DeliveriesPanel timezone="America/Sao_Paulo" recipientNames={{ u1: "Ana" }} showRecipient />,
    );
    expect(await screen.findByText(/nenhuma notificação foi enviada/)).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("Não enviada").length).toBe(1);
    expect(within(table).getByText("Não enviada — canal indisponível")).toBeTruthy();
    expect(within(table).queryByText("Enviada")).toBeNull();
    expect(within(table).getByText("a pessoa não cadastrou telefone")).toBeTruthy();
    expect(within(table).getByText("o WhatsApp ainda não está integrado")).toBeTruthy();
    expect(within(table).getAllByText("Ana").length).toBe(2);
    expect(within(table).getAllByText(/08:00/).length).toBe(2); // 11:00 UTC em São Paulo
  });

  it("CRM-003B.8: aceita pelo n8n NÃO é enviada; só a confirmação do provedor conta", async () => {
    api.listDeliveries.mockResolvedValue({
      items: [
        delivery({
          id: "a",
          status: "pending",
          status_reason: "accepted_by_n8n",
          stage: "accepted",
        }),
        delivery({
          id: "s",
          status: "sent",
          status_reason: "sent_confirmed",
          stage: "sent",
          sent_at: "2026-10-12T11:01:00Z",
        }),
        delivery({
          id: "c",
          status: "sent",
          stage: "confirmed",
          sent_at: "2026-10-12T11:01:00Z",
          confirmed_at: "2026-10-12T11:02:00Z",
        }),
        delivery({
          id: "f",
          status: "failed",
          status_reason: "confirmation_timeout",
          stage: "failed",
        }),
      ],
      total: 4,
      page: 1,
      pageSize: 25,
    });
    render(<DeliveriesPanel timezone="America/Sao_Paulo" showRecipient={false} />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText(/Aceita pelo n8n — aguardando confirmação/)).toBeTruthy();
    expect(within(table).getAllByText("Enviada").length).toBe(1); // só a confirmada pelo provedor
    expect(within(table).getByText("Entregue")).toBeTruthy();
    expect(within(table).getByText(/aceita, mas o envio não foi confirmado a tempo/)).toBeTruthy();
    // Com entregas reais no fluxo, o aviso de "canal indisponível" não aparece.
    expect(screen.queryByText(/nenhuma notificação foi enviada/)).toBeNull();
    expect(screen.getByText(/só que o pedido chegou ao n8n/)).toBeTruthy();
  });

  it("filtra e pagina chamando a API com os filtros suportados", async () => {
    api.listDeliveries.mockResolvedValue({ items: [delivery()], total: 60, page: 1, pageSize: 25 });
    render(<DeliveriesPanel timezone="America/Sao_Paulo" showRecipient={false} />);
    expect(await screen.findByText("Página 1 de 3")).toBeTruthy();
    expect(screen.queryByText("Destinatário")).toBeNull(); // histórico pessoal
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(api.listDeliveries).toHaveBeenLastCalledWith(
        { status: undefined, kind: undefined },
        2,
      ),
    );
    fireEvent.change(screen.getByLabelText("Filtrar por situação"), {
      target: { value: "channel_unavailable" },
    });
    await waitFor(() =>
      expect(api.listDeliveries).toHaveBeenLastCalledWith(
        { status: "channel_unavailable", kind: undefined },
        1,
      ),
    );
  });

  it("vazio e erro", async () => {
    api.listDeliveries.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 25 });
    const first = render(<DeliveriesPanel timezone="UTC" showRecipient={false} />);
    expect(await screen.findByText("Nenhum registro ainda")).toBeTruthy();
    first.unmount();
    api.listDeliveries.mockRejectedValueOnce(new ApiError(0, ""));
    render(<DeliveriesPanel timezone="UTC" showRecipient={false} />);
    expect(await screen.findByText(/Não foi possível conectar/)).toBeTruthy();
  });
});

// ---- guardas e páginas ---------------------------------------------------------------------

describe("acesso por perfil e feature", () => {
  const SECRET = <p>conteúdo protegido</p>;

  it("feature indisponível: nada é renderizado", () => {
    renderAs(
      user({ features: { notifications: false } }),
      <RequireFeature feature="notifications">{SECRET}</RequireFeature>,
    );
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(screen.getByText("Central de Notificações não contratado")).toBeTruthy();
  });

  it("vendedor não abre Configurações → Notificações", () => {
    renderAs(
      user({ role: "vendedor" }),
      <RequirePermission permission="notifications.view">{SECRET}</RequirePermission>,
    );
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(screen.getByText("Acesso restrito")).toBeTruthy();
  });

  it("gestor e admin abrem", () => {
    for (const role of ["gestor", "admin"] as const) {
      const view = renderAs(
        user({ role }),
        <RequirePermission permission="notifications.view">{SECRET}</RequirePermission>,
      );
      expect(screen.getByText("conteúdo protegido")).toBeTruthy();
      view.unmount();
    }
  });
});

describe("NotificationsSettingsPage", () => {
  beforeEach(() => {
    api.getSettings.mockResolvedValue(settings());
    api.listRecipients.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it("admin vê e edita; as seções estão em abas", async () => {
    renderAs(user(), <NotificationsSettingsPage />);
    expect(await screen.findByRole("button", { name: "Salvar política" })).toBeTruthy();
    for (const name of [
      "Política da empresa",
      "Por perfil",
      "Destinatários",
      "Prévia",
      "Histórico",
    ]) {
      expect(screen.getByRole("tab", { name })).toBeTruthy();
    }
    expect(screen.getByText(/O envio por WhatsApp ainda não está disponível/)).toBeTruthy();
  });

  it("gestor consulta a política, mas não edita", async () => {
    renderAs(user({ role: "gestor" }), <NotificationsSettingsPage />);
    expect(await screen.findByText(/Somente o administrador altera/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar política" })).toBeNull();
  });

  it("admin em sessão de suporte não edita", async () => {
    renderAs(
      user({ impersonation: { mode: "write", expiresAt: "2099-01-01T00:00:00Z" } as never }),
      <NotificationsSettingsPage />,
    );
    expect(await screen.findByText(/Somente o administrador altera/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar política" })).toBeNull();
  });

  it("estados de loading, 403, feature bloqueada no backend e rede", async () => {
    api.getSettings.mockReturnValue(new Promise(() => {}));
    const loading = renderAs(user(), <NotificationsSettingsPage />);
    expect(screen.getByText(/Carregando notificações/)).toBeTruthy();
    loading.unmount();

    api.getSettings.mockRejectedValue(new ApiError(403, "Funcionalidade não contratada"));
    const denied = renderAs(user(), <NotificationsSettingsPage />);
    expect(await screen.findByText("Sem acesso")).toBeTruthy();
    expect(screen.getByText("Funcionalidade não contratada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
    denied.unmount();

    api.getSettings.mockRejectedValue(new ApiError(0, ""));
    renderAs(user(), <NotificationsSettingsPage />);
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("demonstração: informa que não está disponível", async () => {
    const { NotImplementedError } = await import("../../src/utils/errors");
    api.getSettings.mockRejectedValue(new NotImplementedError("Notificações"));
    renderAs(user(), <NotificationsSettingsPage />);
    expect(await screen.findByText("Indisponível na demonstração")).toBeTruthy();
  });

  it("não grava nada ao abrir (só GET)", async () => {
    renderAs(user(), <NotificationsSettingsPage />);
    await screen.findByRole("button", { name: "Salvar política" });
    expect(api.updateSettings).not.toHaveBeenCalled();
    expect(api.updateMyPreferences).not.toHaveBeenCalled();
  });
});

describe("MyNotificationsPage", () => {
  beforeEach(() => {
    api.getSettings.mockResolvedValue(settings());
    api.getMyPreferences.mockResolvedValue(prefs());
  });

  it("vendedor gerencia a própria preferência, telefone e consentimento", async () => {
    renderAs(user({ role: "vendedor" }), <MyNotificationsPage />);
    expect(await screen.findByRole("button", { name: "Salvar preferências" })).toBeTruthy();
    expect(screen.getByLabelText("Telefone (o mesmo do seu cadastro)")).toBeTruthy();
    for (const name of ["Preferências", "Prévia", "Meu histórico"]) {
      expect(screen.getByRole("tab", { name })).toBeTruthy();
    }
  });

  it("sessão de suporte: somente leitura", async () => {
    renderAs(
      user({ impersonation: { mode: "write", expiresAt: "2099-01-01T00:00:00Z" } as never }),
      <MyNotificationsPage />,
    );
    expect(await screen.findByText(/Sessão de suporte/)).toBeTruthy();
    expect((screen.getByLabelText("Telefone (o mesmo do seu cadastro)") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar preferências" })).toBeNull();
  });

  it("suporte sem vínculo de membro recebe 403 explicado", async () => {
    api.getMyPreferences.mockRejectedValue(
      new ApiError(403, "Preferências de notificação são só de membros ativos"),
    );
    renderAs(user(), <MyNotificationsPage />);
    expect(await screen.findByText("Sem acesso")).toBeTruthy();
  });

  it("aba de prévia pessoal não oferece envio", async () => {
    renderAs(user({ role: "vendedor" }), <MyNotificationsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Prévia" }));
    expect(await screen.findByText(/Nenhuma mensagem será enviada/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /enviar/i })).toBeNull();
  });
});
