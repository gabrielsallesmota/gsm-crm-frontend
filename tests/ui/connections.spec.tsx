// CRM-003B.4 a B.6 — telas de Conexões, retorno do OAuth, origem dos itens e
// botão de e-mail, com os componentes REAIS (jsdom). O serviço é substituído:
// nenhum teste fala com Google, Microsoft ou rede, e nenhum token existe aqui.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/ConnectionsService", () => ({
  connectionsService: {
    overview: vi.fn(),
    updatePolicy: vi.fn(),
    list: vi.fn(),
    authorize: vi.fn(),
    completeAuthorization: vi.fn(),
    connectWithPassword: vi.fn(),
    update: vi.fn(),
    disconnect: vi.fn(),
    calendars: vi.fn(),
    taskLists: vi.fn(),
    syncNow: vi.fn(),
    syncRuns: vi.fn(),
    publishEvent: vi.fn(),
    publishTask: vi.fn(),
    retryPublish: vi.fn(),
  },
}));

import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { ToastProvider } from "../../src/contexts/ToastProvider";
import { ConnectionCard } from "../../src/components/connections/ConnectionCard";
import { EmailButton } from "../../src/components/leads/EmailButton";
import { ProviderSection } from "../../src/components/connections/ProviderSection";
import { SourceBadge } from "../../src/components/connections/SourceBadge";
import { ConnectionsCallbackPage } from "../../src/pages/ConnectionsCallbackPage";
import { MyConnectionsPage } from "../../src/pages/MyConnectionsPage";
import { connectionsService } from "../../src/services/ConnectionsService";
import type { AuthUser } from "../../src/types/auth";
import { ApiError } from "../../src/types/common";
import type { Lead } from "../../src/types/lead";
import { toConnection, toOverview } from "../../src/utils/connections";

const api = vi.mocked(connectionsService);

afterEach(cleanup);

const connDto = (extra: Record<string, unknown> = {}) => ({
  id: "c1",
  provider: "google",
  account_email: "ana@example.com",
  status: "active",
  needs_reconnect: false,
  calendar_enabled: true,
  tasks_enabled: true,
  automatic_sync_enabled: true,
  manual_sync_enabled: true,
  interval_minutes: 15,
  selected_calendars: [{ id: "cal-1", name: "Pessoal" }],
  selected_task_lists: [],
  sync_status: "succeeded",
  last_sync_finished_at: "2026-10-12T10:00:00Z",
  last_success_at: "2026-10-12T10:00:00Z",
  next_sync_at: null,
  consecutive_failures: 0,
  last_error_code: null,
  last_error_message: null,
  ...extra,
});
const conn = (extra: Record<string, unknown> = {}) => toConnection(connDto(extra));

const overview = (policy: Record<string, unknown> = {}, providers?: unknown[]) =>
  toOverview({
    providers: providers ?? [
      { provider: "google", label: "Google", configured: true, allowed: true, features: ["calendar", "tasks"] },
      { provider: "microsoft", label: "Microsoft", configured: false, allowed: true, features: ["calendar", "tasks"] },
    ],
    policy: { google_allowed: true, microsoft_allowed: true, persisted: false, ...policy },
  });

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "a@example.com",
    name: "Ana",
    role: "vendedor",
    mustChangePassword: false,
    accountId: "acc",
    tenantId: "t1",
    isPlatformStaff: false,
    features: { calendar_task_integrations: true },
    ...overrides,
  };
}

function renderAs(principal: AuthUser | null, ui: ReactNode, path = "/") {
  const value = { user: principal, loading: false } as unknown as AuthContextValue;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={value}>
        <ToastProvider>{ui}</ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  api.overview.mockResolvedValue(overview());
  api.list.mockResolvedValue([conn()]);
});

describe("Meu perfil → Conexões", () => {
  it("lista provedores, a conta conectada e avisa o que não está configurado", async () => {
    renderAs(user(), <MyConnectionsPage />);
    expect(await screen.findByText("ana@example.com")).toBeTruthy();
    expect(screen.getByText(/ainda não foi configurada neste ambiente/)).toBeTruthy();
    expect(screen.getByText(/nunca ao seu e-mail/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conectar outra conta" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/token|secret/i);
  });

  it("provedor bloqueado pela empresa não oferece conectar", async () => {
    api.overview.mockResolvedValue(overview({ google_allowed: false }));
    api.list.mockResolvedValue([]);
    renderAs(user(), <MyConnectionsPage />);
    expect(await screen.findByText(/não permite conexões com Google/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar conta" })).toBeNull();
  });

  it("só o administrador vê e salva a política da empresa", async () => {
    renderAs(user({ role: "vendedor" }), <MyConnectionsPage />);
    await screen.findByText("ana@example.com");
    expect(screen.queryByText("Integrações permitidas pela empresa")).toBeNull();
    cleanup();

    api.updatePolicy.mockResolvedValue({
      googleAllowed: true,
      microsoftAllowed: false,
      appleAllowed: true,
      persisted: true,
    });
    renderAs(user({ role: "admin" }), <MyConnectionsPage />);
    expect(await screen.findByText("Integrações permitidas pela empresa")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Salvar política" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const microsoft = screen.getAllByRole("checkbox", { name: "Microsoft" })[0] as HTMLInputElement;
    fireEvent.click(microsoft);
    fireEvent.click(save);
    await waitFor(() =>
      expect(api.updatePolicy).toHaveBeenCalledWith({
        googleAllowed: true,
        microsoftAllowed: false,
        appleAllowed: true,
      }),
    );
  });

  it("sessão de suporte: somente consulta", async () => {
    renderAs(
      user({ role: "admin", impersonation: { mode: "write", expiresAt: "2099-01-01T00:00:00Z" } as never }),
      <MyConnectionsPage />,
    );
    expect(await screen.findByText(/Sessão de suporte/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Desconectar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Conectar outra conta" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Integrações permitidas pela empresa")).toBeNull();
  });

  it("403 do backend (recurso não contratado) vira 'Sem acesso'", async () => {
    api.overview.mockRejectedValue(new ApiError(403, "Recurso não contratado"));
    renderAs(user(), <MyConnectionsPage />);
    expect(await screen.findByText("Sem acesso")).toBeTruthy();
  });
});

describe("conectar e reconectar", () => {
  it("pede a URL ao backend, lembra o provedor por state e redireciona", async () => {
    api.authorize.mockResolvedValue("https://accounts.example/auth?state=ST-9&code_challenge=x");
    const redirect = vi.fn();
    const info = overview().providers[0]!;
    renderAs(
      user(),
      <ProviderSection
        info={info}
        connections={[]}
        readOnly={false}
        onChanged={vi.fn()}
        onRemoved={vi.fn()}
        redirect={redirect}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Tarefas" })); // só Agenda
    fireEvent.click(screen.getByRole("button", { name: "Conectar conta" }));
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1));
    expect(api.authorize).toHaveBeenCalledWith("google", ["calendar"]);
    expect(redirect).toHaveBeenCalledWith("https://accounts.example/auth?state=ST-9&code_challenge=x");
    expect(window.sessionStorage.getItem("gsm_oauth_provider:ST-9")).toBe("google");
  });

  it("não deixa conectar sem escolher ao menos uma funcionalidade", () => {
    renderAs(
      user(),
      <ProviderSection
        info={overview().providers[0]!}
        connections={[]}
        readOnly={false}
        onChanged={vi.fn()}
        onRemoved={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Agenda" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Tarefas" }));
    expect((screen.getByRole("button", { name: "Conectar conta" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("conexão revogada pede reconexão com instrução clara", async () => {
    renderAs(
      user(),
      <ConnectionCard
        connection={conn({ needs_reconnect: true, status: "needs_reconnect", sync_status: "reconnect_required" })}
        readOnly={false}
        onChanged={vi.fn()}
        onRemoved={vi.fn()}
        onReconnect={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/Conecte novamente/);
    expect(screen.getByRole("button", { name: "Reconectar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sincronizar agora" })).toBeNull();
  });
});

describe("conta conectada", () => {
  const renderCard = (c = conn(), extra: Partial<{ onChanged: () => void; onRemoved: () => void }> = {}) =>
    renderAs(
      user(),
      <ConnectionCard
        connection={c}
        readOnly={false}
        onChanged={extra.onChanged ?? vi.fn()}
        onRemoved={extra.onRemoved ?? vi.fn()}
        onReconnect={vi.fn()}
      />,
    );

  it("sincronizar agora chama o backend; sem seleção o botão fica desligado", async () => {
    const onChanged = vi.fn();
    api.syncNow.mockResolvedValue(conn({ sync_status: "waiting" }));
    renderCard(conn(), { onChanged });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar agora" }));
    await waitFor(() => expect(api.syncNow).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    cleanup();
    renderCard(conn({ selected_calendars: [] }));
    expect((screen.getByRole("button", { name: "Sincronizar agora" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("preferências salvam só o que mudou", async () => {
    api.update.mockResolvedValue(conn({ automatic_sync_enabled: false }));
    renderCard();
    fireEvent.click(screen.getByRole("checkbox", { name: "Sincronizar automaticamente" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("c1", { automaticSyncEnabled: false }));
    expect(screen.getByText("a cada 15 minutos")).toBeTruthy();
  });

  it("escolher calendários mostra os do provedor e salva a seleção", async () => {
    api.calendars.mockResolvedValue([
      { id: "cal-1", name: "Pessoal", primary: true, writable: true, selected: true },
      { id: "cal-2", name: "Equipe", primary: false, writable: false, selected: false },
    ]);
    api.taskLists.mockResolvedValue([{ id: "l1", name: "Minhas tarefas", selected: false }]);
    api.update.mockResolvedValue(conn());
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Escolher calendários e listas" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Equipe" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Minhas tarefas" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar seleção" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith("c1", { calendarIds: ["cal-1", "cal-2"], taskListIds: ["l1"] }),
    );
  });

  it("desconectar: padrão mantém o importado; a opção remove as cópias", async () => {
    api.disconnect.mockResolvedValue({ providerRevoked: true, purgedEvents: 0, purgedTasks: 0 });
    const onRemoved = vi.fn();
    renderCard(conn(), { onRemoved });
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(screen.getByText(/Nada é apagado no/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Remover também os compromissos/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Desconectar" }).at(-1)!);
    await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith("c1", true));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("c1"));
  });

  it("falha do backend não aplica mudança nem derruba a tela", async () => {
    api.syncNow.mockRejectedValue(new ApiError(409, "Aguarde alguns instantes"));
    const onChanged = vi.fn();
    renderCard(conn(), { onChanged });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar agora" }));
    await waitFor(() => expect(api.syncNow).toHaveBeenCalled());
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Sincronizar agora" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText("ana@example.com")).toBeTruthy();
  });
});

describe("Apple (senha de app)", () => {
  const appleInfo = toOverview({
    providers: [
      {
        provider: "apple",
        label: "Apple",
        configured: true,
        allowed: true,
        features: ["calendar"],
        auth_kind: "app_password",
      },
    ],
    policy: {},
  }).providers[0]!;
  const appleConn = (extra: Record<string, unknown> = {}) =>
    conn({ id: "a1", provider: "apple", account_email: "ana@icloud.com", tasks_enabled: false, ...extra });

  function section(connections: ReturnType<typeof conn>[], onChanged = vi.fn()) {
    renderAs(
      user(),
      <ProviderSection
        info={appleInfo}
        connections={connections}
        readOnly={false}
        onChanged={onChanged}
        onRemoved={vi.fn()}
        redirect={vi.fn()}
      />,
    );
    return onChanged;
  }

  it("conecta pelo formulário, sem redirecionar e sem guardar a senha na tela", async () => {
    api.connectWithPassword.mockResolvedValue(appleConn());
    const onChanged = section([]);
    expect(screen.queryByText("O que conectar")).toBeNull(); // sem escolha de tarefas
    expect(screen.getByRole("link", { name: "account.apple.com" }).getAttribute("rel")).toContain("noopener");
    // AP-03: a pessoa sabe o que a senha de app libera e como cortar o acesso
    const note = screen.getByRole("note");
    expect(note.textContent).toMatch(/e-mail e os contatos do iCloud/);
    expect(note.textContent).toMatch(/não revoga a senha na Apple/);
    const submit = screen.getByRole("button", { name: "Conectar agenda da Apple" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Apple ID (e-mail)"), { target: { value: "ana@icloud.com" } });
    const password = screen.getByLabelText("Senha de app") as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.change(password, { target: { value: "MinhaSenha123" } });
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/não parece uma senha de app/)).toBeTruthy();
    fireEvent.change(password, { target: { value: "abcd-efgh-ijkl-mnop" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.connectWithPassword).toHaveBeenCalledWith("apple", "ana@icloud.com", "abcd-efgh-ijkl-mnop"),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" })));
    expect(api.authorize).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain("abcd-efgh-ijkl-mnop");
  });

  it("senha recusada mostra o motivo e limpa o campo", async () => {
    api.connectWithPassword.mockRejectedValue(
      new ApiError(422, "O Apple ID ou a senha de app não conferem."),
    );
    section([]);
    fireEvent.change(screen.getByLabelText("Apple ID (e-mail)"), { target: { value: "ana@icloud.com" } });
    fireEvent.change(screen.getByLabelText("Senha de app"), { target: { value: "abcdefghijklmnop" } });
    fireEvent.click(screen.getByRole("button", { name: "Conectar agenda da Apple" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Senha de app") as HTMLInputElement).value).toBe("");
  });

  it("conta Apple só agenda; reconectar reabre o formulário com o Apple ID", async () => {
    section([appleConn({ needs_reconnect: true, status: "needs_reconnect" })]);
    expect(screen.getByText(/A Apple recusou a senha de app/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Tarefas" })).toBeNull();
    expect(screen.queryByLabelText("Senha de app")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reconectar" }));
    expect((screen.getByLabelText("Apple ID (e-mail)") as HTMLInputElement).value).toBe("ana@icloud.com");
    expect(api.authorize).not.toHaveBeenCalled();
  });
});

describe("retorno do consentimento", () => {
  function renderCallback(url: string, strict = false) {
    const tree = (
      <MemoryRouter initialEntries={[url]}>
        <AuthContext.Provider value={{ user: user(), loading: false } as unknown as AuthContextValue}>
          <Routes>
            <Route path="/perfil/conexoes/callback" element={<ConnectionsCallbackPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );
    return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  }

  it("conclui uma única vez mesmo com montagem dupla e avisa permissão não concedida", async () => {
    window.sessionStorage.setItem("gsm_oauth_provider:ST-1", "google");
    api.completeAuthorization.mockResolvedValue({
      connection: conn(),
      missingFeatures: ["tasks"],
    });
    renderCallback("/perfil/conexoes/callback?state=ST-1&code=C1", true);
    expect(await screen.findByText(/ana@example.com conectada/)).toBeTruthy();
    expect(api.completeAuthorization).toHaveBeenCalledTimes(1);
    expect(api.completeAuthorization).toHaveBeenCalledWith("google", { state: "ST-1", code: "C1" });
    expect(screen.getByRole("alert").textContent).toMatch(/Tarefas/);
    expect(window.location.search).toBe(""); // código fora da barra de endereço
  });

  it("consentimento negado é repassado e explicado", async () => {
    window.sessionStorage.setItem("gsm_oauth_provider:ST-2", "microsoft");
    api.completeAuthorization.mockRejectedValue(new ApiError(422, "A autorização foi cancelada"));
    renderCallback("/perfil/conexoes/callback?state=ST-2&error=access_denied");
    expect(await screen.findByText(/foi cancelada/)).toBeTruthy();
    expect(api.completeAuthorization).toHaveBeenCalledWith("microsoft", {
      state: "ST-2",
      error: "access_denied",
    });
  });

  it("sem state/código ou sem provedor lembrado, não chama o backend", async () => {
    renderCallback("/perfil/conexoes/callback?code=X");
    expect(await screen.findByText(/não é um retorno de autorização válido/)).toBeTruthy();
    cleanup();
    renderCallback("/perfil/conexoes/callback?state=ST-3&code=X");
    expect(await screen.findByText(/Inicie a conexão novamente/)).toBeTruthy();
    expect(api.completeAuthorization).not.toHaveBeenCalled();
  });
});

describe("origem dos itens e e-mail", () => {
  it("item do CRM não mostra origem; externo mostra e só linka http(s)", () => {
    const { container, rerender } = render(<SourceBadge source="crm" url={null} />);
    expect(container.textContent).toBe("");
    rerender(<SourceBadge source="google" url="https://calendar.google.com/e/1" readOnly />);
    expect(screen.getByText("Google")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Abrir no Google" }) as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    rerender(<SourceBadge source="microsoft" url="javascript:alert(1)" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  const lead = (email: string): Lead => ({ name: "Maria", company: "Acme", email }) as unknown as Lead;

  it("botão de e-mail é um mailto: (o CRM não envia nada)", () => {
    render(<EmailButton lead={lead("maria@acme.com")} />);
    const link = screen.getByRole("link", { name: /Escrever e-mail para Maria/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toMatch(/^mailto:maria@acme\.com\?subject=/);
    expect(link.title).toMatch(/nada é enviado pelo CRM/);
  });

  it("sem e-mail válido o botão não aparece", () => {
    const { container } = render(<EmailButton lead={lead("")} />);
    expect(container.textContent).toBe("");
    cleanup();
    const bad = render(<EmailButton lead={lead("a@c.com,b@c.com")} />);
    expect(bad.container.textContent).toBe("");
  });
});
