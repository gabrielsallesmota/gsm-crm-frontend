import { apiRequest } from "../repositories/api/ApiClient";
import { isDemoMode } from "./factory";
import type {
  ChannelProvider,
  ChatMessage,
  ConversationDetail,
  ConversationFilter,
  ConversationLead,
  ConversationSummary,
  MessageStatus,
  MessagingSettings,
  Ref,
  WhatsappConnectResult,
  WhatsappConnection,
  WhatsappState,
  WhatsappStatus,
} from "../utils/messaging";

export type * from "../utils/messaging";

type Dto = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const obj = (v: unknown): Dto | null => (v && typeof v === "object" ? (v as Dto) : null);

const WA = "/api/v1/messaging/whatsapp";
const CONV = "/api/v1/messaging/conversations";
const SETTINGS = "/api/v1/messaging/settings";

const WA_STATES: WhatsappState[] = ["creating", "qr_pending", "connected", "disconnected", "error"];

function toConnection(d: Dto): WhatsappConnection {
  const status = str(d.status) as WhatsappState | null;
  return {
    status: status && WA_STATES.includes(status) ? status : "disconnected",
    phone: str(d.phone),
    displayName: str(d.display_name),
    lastConnectedAt: str(d.last_connected_at),
    error: str(d.error),
  };
}

function toRef(v: unknown): Ref | null {
  const d = obj(v);
  return d && typeof d.id === "string" ? { id: d.id, name: str(d.name) } : null;
}

function toProvider(v: unknown): ChannelProvider {
  return v === "instagram" ? "instagram" : "whatsapp_evolution";
}

function toLead(v: unknown): ConversationLead | null {
  const d = obj(v);
  if (!d || typeof d.id !== "string") return null;
  return {
    id: d.id,
    name: str(d.name),
    owner: toRef(d.owner),
    pipeline: toRef(d.pipeline),
    stage: toRef(d.stage),
  };
}

function toSummary(d: Dto): ConversationSummary {
  const direction = d.last_direction;
  return {
    id: String(d.id),
    provider: toProvider(d.provider),
    title: str(d.title) ?? "Contato",
    phone: str(d.phone),
    lastMessageAt: str(d.last_message_at),
    lastPreview: str(d.last_preview),
    lastDirection: direction === "in" || direction === "out" ? direction : null,
    unreadCount: typeof d.unread_count === "number" ? d.unread_count : 0,
    lead: toLead(d.lead),
  };
}

function toMessage(d: Dto): ChatMessage {
  return {
    id: String(d.id),
    direction: d.direction === "out" ? "out" : "in",
    type: str(d.type) ?? "text",
    body: str(d.body),
    status: (str(d.status) ?? "received") as MessageStatus,
    at: str(d.at) ?? "",
    sentBy: toRef(d.sent_by),
    error: str(d.error),
  };
}

function toSettings(d: Dto): MessagingSettings {
  return {
    retentionMonths: typeof d.retention_months === "number" ? d.retention_months : 12,
    instagramAutoCreateLeads: d.instagram_auto_create_leads !== false,
    version: typeof d.version === "number" ? d.version : 0,
  };
}

function query(filter: ConversationFilter, before?: string): string {
  const p = new URLSearchParams();
  if (filter.q) p.set("q", filter.q);
  if (filter.ownerId) p.set("owner_id", filter.ownerId);
  if (filter.pipelineId) p.set("pipeline_id", filter.pipelineId);
  if (filter.stageId) p.set("stage_id", filter.stageId);
  if (filter.unread) p.set("unread", "true");
  if (before) p.set("before", before);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const whatsappService = {
  async status(): Promise<WhatsappStatus> {
    if (isDemoMode) return { configured: false, connection: null };
    const d = await apiRequest<Dto>(WA);
    const c = obj(d.connection);
    return { configured: d.configured === true, connection: c ? toConnection(c) : null };
  },

  /** Conectar e Reconectar: o backend cria a instância na 1ª vez e devolve um QR novo. */
  async connect(): Promise<WhatsappConnectResult> {
    const d = await apiRequest<Dto>(`${WA}/connect`, { method: "POST" });
    return {
      connection: toConnection(obj(d.connection) ?? {}),
      qrCode: str(d.qr_code),
      pairingCode: str(d.pairing_code),
    };
  },

  /** Devolve o aviso do backend quando a Evolution não reconheceu a instância (desconectou só no CRM). */
  async disconnect(): Promise<{ notice: string | null }> {
    const d = await apiRequest<Dto>(`${WA}/disconnect`, { method: "POST" });
    return { notice: str(d?.notice) };
  },
};

export const conversationsService = {
  async list(
    filter: ConversationFilter,
    before?: string,
  ): Promise<{ items: ConversationSummary[]; nextBefore: string | null }> {
    if (isDemoMode) return { items: [], nextBefore: null };
    const d = await apiRequest<Dto>(`${CONV}${query(filter, before)}`);
    const items = Array.isArray(d.items) ? (d.items as Dto[]).map(toSummary) : [];
    return { items, nextBefore: str(d.next_before) };
  },

  async get(id: string): Promise<ConversationDetail> {
    const d = await apiRequest<Dto>(`${CONV}/${id}`);
    const account = obj(d.account) ?? {};
    const reply = obj(d.reply) ?? {};
    return {
      id: String(d.id),
      provider: toProvider(d.provider),
      title: str(d.title) ?? "Contato",
      phone: str(d.phone),
      leadId: str(d.lead_id),
      identityConfirmed: d.identity_confirmed !== false,
      account: {
        username: str(account.username),
        phone: str(account.phone),
        status: str(account.status) ?? "",
      },
      reply: { allowed: reply.allowed === true, reason: str(reply.reason), until: str(reply.until) },
    };
  },

  async messages(id: string, before?: string): Promise<ChatMessage[]> {
    return (await this.page(id, before ? { before } : {})).items;
  },

  /** Página de mensagens + o relógio do servidor. Com `since`, só o que entrou ou mudou depois. */
  async page(
    id: string,
    opts: { before?: string; since?: string } = {},
  ): Promise<{ items: ChatMessage[]; serverTime: string | null }> {
    const params = new URLSearchParams();
    if (opts.before) params.set("before", opts.before);
    if (opts.since) params.set("since", opts.since);
    const suffix = params.size ? `?${params.toString()}` : "";
    const d = await apiRequest<Dto>(`${CONV}/${id}/messages${suffix}`);
    return {
      items: Array.isArray(d.items) ? (d.items as Dto[]).map(toMessage) : [],
      serverTime: str(d.server_time),
    };
  },

  async send(id: string, text: string, clientRequestId: string): Promise<void> {
    await apiRequest<Dto>(`${CONV}/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, client_request_id: clientRequestId }),
    });
  },

  async retry(id: string, messageId: string): Promise<void> {
    await apiRequest<Dto>(`${CONV}/${id}/messages/${messageId}/retry`, { method: "POST" });
  },

  async markRead(id: string): Promise<void> {
    await apiRequest<void>(`${CONV}/${id}/read`, { method: "POST" });
  },

  async linkLead(id: string, leadId: string): Promise<void> {
    await apiRequest<Dto>(`${CONV}/${id}/link-lead`, {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId }),
    });
  },
};

export const messagingSettingsService = {
  async get(): Promise<MessagingSettings> {
    if (isDemoMode) return { retentionMonths: 12, instagramAutoCreateLeads: true, version: 0 };
    return toSettings(await apiRequest<Dto>(SETTINGS));
  },

  async save(input: MessagingSettings): Promise<MessagingSettings> {
    const d = await apiRequest<Dto>(SETTINGS, {
      method: "PUT",
      body: JSON.stringify({
        version: input.version,
        retention_months: input.retentionMonths,
        instagram_auto_create_leads: input.instagramAutoCreateLeads,
      }),
    });
    return toSettings(d);
  },
};
