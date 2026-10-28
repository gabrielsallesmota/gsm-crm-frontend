// Correção da auditoria das integrações (2026-10-28, TST-06): telas de Conversas, WhatsApp,
// Instagram, regras das conversas e retorno do login do Instagram, com os componentes REAIS (jsdom).
// Os serviços são substituídos: nenhum teste fala com a Evolution, a Meta ou a rede.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/MessagingService", () => ({
  whatsappService: { status: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
  conversationsService: {
    list: vi.fn(),
    get: vi.fn(),
    messages: vi.fn(),
    page: vi.fn(),
    send: vi.fn(),
    retry: vi.fn(),
    markRead: vi.fn(),
    linkLead: vi.fn(),
  },
  messagingSettingsService: { get: vi.fn(), save: vi.fn() },
}));
vi.mock("../../src/services/InstagramService", async () => {
  const real = await vi.importActual<typeof import("../../src/utils/instagram")>("../../src/utils/instagram");
  return {
    describeInstagram: real.describeInstagram,
    instagramService: { status: vi.fn(), authorize: vi.fn(), complete: vi.fn(), disconnect: vi.fn() },
  };
});
vi.mock("../../src/services/PipelinesService", () => ({ pipelinesService: { list: vi.fn() } }));
vi.mock("../../src/services/UsersService", () => ({ usersService: { directory: vi.fn() } }));
vi.mock("../../src/services/LeadsService", () => ({
  leadsService: { list: vi.fn(), update: vi.fn(), claim: vi.fn(), move: vi.fn() },
}));
vi.mock("../../src/hooks/useMediaQuery", () => ({ useIsMobile: () => false, useMediaQuery: () => false }));

import { ChatPanel } from "../../src/components/conversations/ChatPanel";
import { LeadSidePanel } from "../../src/components/conversations/LeadSidePanel";
import { InstagramTab } from "../../src/components/integrations/InstagramTab";
import { MessagingSettingsTab } from "../../src/components/integrations/MessagingSettingsTab";
import { WhatsappTab } from "../../src/components/integrations/WhatsappTab";
import { ConversationsPage } from "../../src/pages/ConversationsPage";
import { InstagramCallbackPage } from "../../src/pages/InstagramCallbackPage";
import { instagramService } from "../../src/services/InstagramService";
import { leadsService } from "../../src/services/LeadsService";
import {
  conversationsService,
  messagingSettingsService,
  whatsappService,
} from "../../src/services/MessagingService";
import { pipelinesService } from "../../src/services/PipelinesService";
import { usersService } from "../../src/services/UsersService";
import { ApiError } from "../../src/types/common";
import type { ChatMessage, ConversationDetail, ConversationSummary } from "../../src/utils/messaging";
import { ADMIN, makePipeline, renderApp, VENDEDOR } from "./support/harness";

const wa = vi.mocked(whatsappService);
const conv = vi.mocked(conversationsService);
const settings = vi.mocked(messagingSettingsService);
const ig = vi.mocked(instagramService);
const leads = vi.mocked(leadsService);

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  // jsdom não implementa rolagem; o chat desce até a última mensagem ao abrir.
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(pipelinesService.list).mockResolvedValue([makePipeline()]);
  vi.mocked(usersService.directory).mockResolvedValue([
    { id: "u-vend", name: "Vera Vendedora", role: "vendedor" },
  ] as never);
  conv.markRead.mockResolvedValue();
});

const summary = (extra: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: "c1",
  provider: "whatsapp_evolution",
  title: "Maria Cliente",
  phone: "+5511987654321",
  lastMessageAt: "2026-10-28T12:00:00Z",
  lastPreview: "Quero um orçamento",
  lastDirection: "in",
  unreadCount: 2,
  lead: {
    id: "l1",
    name: "Maria Cliente",
    owner: null,
    pipeline: { id: "p1", name: "Comercial" },
    stage: { id: "s-novo", name: "Novo" },
  },
  ...extra,
});

const detail = (extra: Partial<ConversationDetail> = {}): ConversationDetail => ({
  id: "c1",
  provider: "whatsapp_evolution",
  title: "Maria Cliente",
  phone: "+5511987654321",
  leadId: "l1",
  identityConfirmed: true,
  account: { username: null, phone: "+5511900000000", status: "connected" },
  reply: { allowed: true, reason: null, until: null },
  ...extra,
});

const message = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  direction: "in",
  type: "text",
  body: "Quero um orçamento",
  status: "received",
  at: "2026-10-28T12:00:00Z",
  sentBy: null,
  error: null,
  ...extra,
});

function chat(user = ADMIN) {
  return renderApp(
    <Routes>
      <Route path="/conversas/:id" element={<ChatPanel conversationId="c1" summary={summary()} onChanged={() => undefined} />} />
    </Routes>,
    { user, route: "/conversas/c1" },
  );
}

describe("Conversas — lista", () => {
  it("mostra as conversas e o vendedor não vê o filtro de responsável", async () => {
    conv.list.mockResolvedValue({ items: [summary()], nextBefore: null });
    renderApp(<ConversationsPage />, { user: VENDEDOR, route: "/conversas" });
    expect(await screen.findByText("Maria Cliente")).toBeTruthy();
    expect(screen.getByLabelText("2 não lidas")).toBeTruthy();
    expect(screen.queryByLabelText("Responsável")).toBeNull();
    expect(screen.getByText(/Sem responsável · Novo/)).toBeTruthy();
  });

  it("admin vê o filtro de responsável; lista vazia explica o que fazer", async () => {
    conv.list.mockResolvedValue({ items: [], nextBefore: null });
    renderApp(<ConversationsPage />, { user: ADMIN, route: "/conversas" });
    expect(await screen.findByText("Nenhuma conversa")).toBeTruthy();
    expect(screen.getByLabelText("Responsável")).toBeTruthy();
  });

  it("erro ao carregar aparece na tela (sem fingir lista vazia)", async () => {
    conv.list.mockRejectedValue(new ApiError(403, "Recurso não contratado"));
    renderApp(<ConversationsPage />, { route: "/conversas" });
    expect(await screen.findByText(/Recurso não contratado/)).toBeTruthy();
    expect(screen.queryByText("Nenhuma conversa")).toBeNull();
  });
});

describe("Conversas — chat", () => {
  it("envia a resposta e reaproveita o MESMO id quando o envio falha (o backend não duplica)", async () => {
    conv.get.mockResolvedValue(detail());
    conv.page.mockResolvedValue({ items: [message()], serverTime: "2026-10-28T12:00:05Z" });
    conv.send.mockRejectedValueOnce(new ApiError(503, "fora do ar")).mockResolvedValueOnce();
    chat();
    const box = await screen.findByLabelText("Mensagem");
    fireEvent.change(box, { target: { value: "Segue o orçamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(conv.send).toHaveBeenCalledTimes(1));
    expect((box as HTMLTextAreaElement).value).toBe("Segue o orçamento"); // não some no erro
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(conv.send).toHaveBeenCalledTimes(2));
    const [first, second] = conv.send.mock.calls;
    expect(first?.[2]).toBe(second?.[2]);
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(""));
  });

  it("resposta bloqueada mostra o motivo e não tem caixa de texto", async () => {
    conv.get.mockResolvedValue(
      detail({ reply: { allowed: false, reason: "O WhatsApp da empresa está desconectado.", until: null } }),
    );
    conv.page.mockResolvedValue({ items: [message()], serverTime: "2026-10-28T12:00:05Z" });
    chat();
    expect(await screen.findByText("O WhatsApp da empresa está desconectado.")).toBeTruthy();
    expect(screen.queryByLabelText("Mensagem")).toBeNull();
  });

  it("envio interrompido aparece como não confirmado, com o aviso e o botão de reenviar", async () => {
    conv.get.mockResolvedValue(detail());
    conv.page.mockResolvedValue({ items: [
      message(),
      message({ id: "m2", direction: "out", status: "uncertain", error: "send_interrupted", body: "Oi" }),
    ], serverTime: "2026-10-28T12:00:05Z" });
    conv.retry.mockResolvedValue();
    chat();
    expect(await screen.findByText(/O envio foi interrompido: confira no celular/)).toBeTruthy();
    expect(screen.getByLabelText("Envio não confirmado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    await waitFor(() => expect(conv.retry).toHaveBeenCalledWith("c1", "m2"));
  });

  it("conversa que deixou de ser visível (404) some da tela", async () => {
    conv.get.mockRejectedValue(new ApiError(404, "Conversa não encontrada"));
    conv.page.mockResolvedValue({ items: [], serverTime: "2026-10-28T12:00:05Z" });
    chat(VENDEDOR);
    expect(await screen.findByText("Conversa indisponível")).toBeTruthy();
  });

  it("o polling pede só o que mudou desde o relógio do servidor (PERF-01)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      conv.get.mockResolvedValue(detail());
      conv.page
        .mockResolvedValueOnce({ items: [message()], serverTime: "2026-10-28T12:00:05Z" })
        .mockResolvedValue({ items: [message({ id: "m2", body: "Chegou agora" })], serverTime: "2026-10-28T12:00:09Z" });
      chat();
      expect(await screen.findByText("Quero um orçamento")).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_100);
      });
      expect(await screen.findByText("Chegou agora")).toBeTruthy();
      expect(conv.page).toHaveBeenLastCalledWith("c1", { since: "2026-10-28T12:00:05Z" });
      expect(conv.get).toHaveBeenCalledTimes(1); // o cabeçalho não é relido a cada 4 s
    } finally {
      vi.useRealTimers();
    }
  });

  it("texto da mensagem é mostrado como texto (sem HTML)", async () => {
    conv.get.mockResolvedValue(detail());
    conv.page.mockResolvedValue({ items: [message({ body: "<img src=x onerror=alert(1)>" })], serverTime: "2026-10-28T12:00:05Z" });
    const { container } = chat();
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("img[src='x']")).toBeNull();
  });
});

describe("Conversas — lead ao lado", () => {
  it("vendedor não troca o responsável, mas pode vincular a si um lead da fila", async () => {
    leads.claim.mockResolvedValue(undefined as never);
    const onChanged = vi.fn();
    renderApp(
      <LeadSidePanel
        conversationId="c1"
        lead={summary().lead}
        leadId="l1"
        identityConfirmed
        onClose={() => undefined}
        onChanged={onChanged}
      />,
      { user: VENDEDOR },
    );
    expect(screen.getByText("Sem responsável (fila)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vincular a você" }));
    await waitFor(() => expect(leads.claim).toHaveBeenCalledWith("l1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("contato só com LID pede para vincular a um lead existente", async () => {
    leads.list.mockResolvedValue({ items: [{ id: "l9", name: "Maria Antiga", phone: "(11) 9" }], total: 1 } as never);
    conv.linkLead.mockResolvedValue();
    renderApp(
      <LeadSidePanel
        conversationId="c1"
        lead={null}
        leadId={null}
        identityConfirmed={false}
        onClose={() => undefined}
        onChanged={() => undefined}
      />,
    );
    expect(screen.getByText(/não informou o número/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vincular a outro lead" }));
    fireEvent.change(screen.getByLabelText("Buscar lead para vincular"), { target: { value: "Maria" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maria Antiga/ }));
    await waitFor(() => expect(conv.linkLead).toHaveBeenCalledWith("c1", "l9"));
  });
});

describe("Integrações — WhatsApp", () => {
  const connection = (extra = {}) => ({
    status: "disconnected" as const,
    phone: null,
    displayName: null,
    lastConnectedAt: null,
    error: null,
    ...extra,
  });

  it("conectar mostra o QR Code; falha recarrega a situação real (erro gravado no backend)", async () => {
    wa.status.mockResolvedValueOnce({ configured: true, connection: null });
    wa.connect.mockRejectedValueOnce(new ApiError(503, "Não foi possível gerar o QR Code agora."));
    wa.status.mockResolvedValueOnce({
      configured: true,
      connection: connection({ status: "error", error: "Não foi possível falar com o WhatsApp agora." }),
    });
    renderApp(<WhatsappTab readOnly={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByText("Erro na conexão")).toBeTruthy();
    expect(screen.getByText("Não foi possível falar com o WhatsApp agora.")).toBeTruthy();

    wa.connect.mockResolvedValueOnce({
      connection: connection({ status: "qr_pending" }),
      qrCode: "data:image/png;base64,QR",
      pairingCode: "ABCD-1234",
    });
    fireEvent.click(screen.getByRole("button", { name: "Reconectar" }));
    expect(await screen.findByAltText("QR Code para conectar o WhatsApp")).toBeTruthy();
    expect(screen.getByText("ABCD-1234")).toBeTruthy();
  });

  it("desconectar mostra o aviso do backend quando a Evolution não reconheceu a instância", async () => {
    wa.status.mockResolvedValue({ configured: true, connection: connection({ status: "connected", phone: "+5511" }) });
    wa.disconnect.mockResolvedValue({ notice: "remova o aparelho em WhatsApp → Aparelhos conectados." });
    renderApp(<WhatsappTab readOnly={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Desconectar" }));
    expect(await screen.findByText(/Aparelhos conectados/)).toBeTruthy();
  });

  it("sessão de suporte (só leitura) não conecta nem desconecta", async () => {
    wa.status.mockResolvedValue({ configured: true, connection: connection({ status: "connected" }) });
    renderApp(<WhatsappTab readOnly />);
    const button = await screen.findByRole("button", { name: "Desconectar" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem configuração no ambiente avisa e não oferece conectar", async () => {
    wa.status.mockResolvedValue({ configured: false, connection: null });
    renderApp(<WhatsappTab readOnly={false} />);
    expect(await screen.findByText(/ainda não está ativa neste ambiente/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar WhatsApp" })).toBeNull();
  });
});

describe("Integrações — Instagram e regras", () => {
  const account = (extra = {}) => ({
    username: "loja",
    accountType: "BUSINESS",
    status: "active" as const,
    receiving: true,
    tokenExpiresAt: null,
    lastWebhookAt: null,
    error: null,
    connectedAt: "2026-10-28T12:00:00Z",
    ...extra,
  });

  it("conta que precisa reconectar mostra o motivo e o botão", async () => {
    ig.status.mockResolvedValue({
      configured: true,
      account: account({ status: "needs_reconnect", error: "O provedor recusou a credencial ao enviar." }),
    });
    renderApp(<InstagramTab readOnly={false} />);
    expect(await screen.findByText("Precisa reconectar")).toBeTruthy();
    expect(screen.getByText(/recusou a credencial/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conectar de novo" })).toBeTruthy();
  });

  it("regras das conversas só salvam quando algo mudou", async () => {
    settings.get.mockResolvedValue({ retentionMonths: 12, instagramAutoCreateLeads: true, version: 1 });
    settings.save.mockResolvedValue({ retentionMonths: 6, instagramAutoCreateLeads: true, version: 2 });
    renderApp(<MessagingSettingsTab readOnly={false} instagram />);
    const save = await screen.findByRole("button", { name: "Salvar" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "6" } });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(settings.save).toHaveBeenCalledWith(expect.objectContaining({ retentionMonths: 6 })));
  });

  it("retorno do login entrega code+state uma vez e tira os dois da URL", async () => {
    ig.complete.mockResolvedValue(account());
    const replace = vi.spyOn(window.history, "replaceState");
    renderApp(<InstagramCallbackPage />, { route: "/configuracoes/integracoes/instagram/callback?code=AQD%23_&state=st-1" });
    expect(await screen.findByText(/conectada/)).toBeTruthy();
    expect(ig.complete).toHaveBeenCalledTimes(1);
    expect(ig.complete).toHaveBeenCalledWith(expect.objectContaining({ state: "st-1" }));
    expect(replace).toHaveBeenCalled();
  });

  it("retorno sem state é recusado sem chamar o backend", async () => {
    await act(async () => {
      renderApp(<InstagramCallbackPage />, { route: "/configuracoes/integracoes/instagram/callback?code=x" });
    });
    expect(await screen.findByText(/não é um retorno válido/)).toBeTruthy();
    expect(ig.complete).not.toHaveBeenCalled();
  });
});
