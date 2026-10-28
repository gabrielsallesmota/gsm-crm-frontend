/** Conversas (WhatsApp e Instagram) e conexão do WhatsApp: tipos e regras de exibição (puro, sem
 * chamadas de API — roda também no `npm test`). */

export type ChannelProvider = "whatsapp_evolution" | "instagram";
export type WhatsappState = "creating" | "qr_pending" | "connected" | "disconnected" | "error";
export type MessageStatus =
  | "received"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "uncertain";

/** Conexão do número da empresa (sem token/segredo: eles nunca saem do backend). */
export interface WhatsappConnection {
  status: WhatsappState;
  phone: string | null;
  displayName: string | null;
  lastConnectedAt: string | null;
  error: string | null;
}

export interface WhatsappStatus {
  configured: boolean;
  connection: WhatsappConnection | null;
}

export interface WhatsappConnectResult {
  connection: WhatsappConnection;
  qrCode: string | null;
  pairingCode: string | null;
}

export interface Ref {
  id: string;
  name: string | null;
}

export interface ConversationLead {
  id: string;
  name: string | null;
  owner: Ref | null;
  pipeline: Ref | null;
  stage: Ref | null;
}

export interface ConversationSummary {
  id: string;
  provider: ChannelProvider;
  title: string;
  phone: string | null;
  lastMessageAt: string | null;
  lastPreview: string | null;
  lastDirection: "in" | "out" | null;
  unreadCount: number;
  lead: ConversationLead | null;
}

export interface ConversationDetail {
  id: string;
  provider: ChannelProvider;
  title: string;
  phone: string | null;
  leadId: string | null;
  identityConfirmed: boolean;
  account: { username: string | null; phone: string | null; status: string };
  reply: { allowed: boolean; reason: string | null; until: string | null };
}

export interface ChatMessage {
  id: string;
  direction: "in" | "out";
  type: string;
  body: string | null;
  status: MessageStatus;
  at: string;
  sentBy: Ref | null;
  error: string | null;
}

export interface ConversationFilter {
  q?: string | undefined;
  ownerId?: string | undefined;
  pipelineId?: string | undefined;
  stageId?: string | undefined;
  unread?: boolean | undefined;
}

export interface MessagingSettings {
  retentionMonths: number;
  instagramAutoCreateLeads: boolean;
  version: number;
}

export const RETENTION_OPTIONS = [6, 7, 8, 9, 10, 11, 12] as const;
export const WA_TEXT_MAX = 4096;
export const IG_TEXT_MAX_BYTES = 1000;
/** Intervalos de atualização da tela (o backend é a fonte; nada de WebSocket por ora). */
export const POLL_MS = { list: 10_000, chat: 4_000, qr: 3_000, chatDetail: 30_000 } as const;

type Tone = "ok" | "warn" | "bad" | "neutral";

/** Situação da conexão em uma frase (o que a pessoa precisa saber/fazer). */
export function describeWhatsapp(connection: WhatsappConnection | null): { tone: Tone; label: string } {
  if (!connection) return { tone: "neutral", label: "Não conectado" };
  switch (connection.status) {
    case "connected":
      return { tone: "ok", label: "Conectado" };
    case "qr_pending":
    case "creating":
      return { tone: "warn", label: "Aguardando a leitura do QR Code" };
    case "error":
      return { tone: "bad", label: "Erro na conexão" };
    default:
      return { tone: "bad", label: "Desconectado" };
  }
}

/** Enquanto o QR está na tela, a tela pergunta o status a cada 3 s. */
export function shouldPollQr(connection: WhatsappConnection | null, hasQr: boolean): boolean {
  return hasQr && connection !== null && connection.status !== "connected";
}

export function channelLabel(provider: ChannelProvider): string {
  return provider === "instagram" ? "Instagram" : "WhatsApp";
}

/** Ícone curto + texto acessível do status de uma mensagem enviada. */
export function messageStatusInfo(status: MessageStatus): { icon: string; label: string; tone: Tone } {
  switch (status) {
    case "queued":
    case "sending":
      return { icon: "🕓", label: "Enviando", tone: "neutral" };
    case "sent":
      return { icon: "✓", label: "Enviada", tone: "neutral" };
    case "delivered":
      return { icon: "✓✓", label: "Entregue", tone: "neutral" };
    case "read":
      return { icon: "✓✓", label: "Lida", tone: "ok" };
    case "failed":
      return { icon: "!", label: "Não enviada", tone: "bad" };
    case "uncertain":
      return { icon: "?", label: "Envio não confirmado", tone: "warn" };
    default:
      return { icon: "", label: "Recebida", tone: "neutral" };
  }
}

/** Só se reenvia o que falhou ou não teve confirmação (nunca sozinho: pode já ter saído). */
export function canRetry(status: MessageStatus): boolean {
  return status === "failed" || status === "uncertain";
}

/** Erro técnico do envio → frase para o vendedor. */
export function describeSendError(code: string | null): string | null {
  if (!code) return null;
  if (code === "window_closed") return "A janela de 24 h do Instagram fechou antes do envio.";
  if (code === "send_interrupted") return "O envio foi interrompido: confira no celular antes de reenviar.";
  if (code === "channel_disabled") return "Este canal foi desligado para a empresa.";
  if (code.endsWith("_timeout")) return "O provedor não respondeu: confira no celular antes de reenviar.";
  if (code.endsWith("_401") || code.endsWith("_403") || code === "meta_190") {
    return "O canal recusou a credencial: peça ao administrador para reconectar.";
  }
  if (code.includes("disconnected") || code.includes("reconnect")) return "O canal da empresa está desconectado.";
  return "O provedor recusou a mensagem.";
}

/** Validação do texto antes de mandar (o backend valida de novo). */
export function validateReply(provider: ChannelProvider, text: string): string | null {
  const body = text.trim();
  if (!body) return "Escreva a mensagem.";
  if (provider === "instagram") {
    if (new TextEncoder().encode(body).length > IG_TEXT_MAX_BYTES) {
      return "No Instagram a mensagem pode ter até 1000 caracteres.";
    }
  } else if (body.length > WA_TEXT_MAX) {
    return `A mensagem pode ter até ${WA_TEXT_MAX} caracteres.`;
  }
  return null;
}

/** Identificador do envio: o mesmo clique repetido (ou rede instável) não duplica a mensagem. */
export function newClientRequestId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `web-${random}`;
}

/** Junta a página nova de mensagens com as já na tela (sem duplicar, em ordem de horário). */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** "há 5 min", "14:32", "ontem", "12/10" — horário curto da lista de conversas. */
export function shortWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const at = new Date(iso);
  const diffMin = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay) return at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return "ontem";
  return at.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Quanto falta para a janela do Instagram fechar ("fecha em 3 h"). */
export function windowHint(until: string | null, now: Date = new Date()): string | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - now.getTime();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Janela do Instagram fecha em ${hours} h`;
  return `Janela do Instagram fecha em ${Math.max(1, Math.floor(ms / 60_000))} min`;
}
