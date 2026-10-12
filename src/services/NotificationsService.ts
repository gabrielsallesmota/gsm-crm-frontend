import { apiRequest } from "../repositories/api/ApiClient";
import { NotImplementedError } from "../utils/errors";
import { selectRepository } from "./factory";
import {
  toDelivery,
  toPreferences,
  toPreview,
  toRecipient,
  toSettings,
} from "../utils/notifications";
import type { Page } from "../types/common";
import type { TenantRole } from "../auth/permissions";
import type {
  Delivery,
  DeliveryFilters,
  DigestPreview,
  MyPreferences,
  NotificationSettings,
  PolicyPatch,
  Recipient,
  UpdateMyPreferencesInput,
} from "../types/notifications";

/**
 * Central de Notificações (CRM-003B.3) — consome as APIs reais do B.2.
 * Nenhuma chamada aqui envia mensagem (o WhatsApp entra no B.8) e nenhuma
 * fala com n8n/Google/Microsoft. Autorização: backend (feature
 * `notifications`, papel, sessão de suporte).
 */

type Dto = Record<string, unknown>;
const BASE = "/api/v1/notifications";

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function toPage<T>(dto: Dto, map: (d: unknown) => T): Page<T> {
  return {
    items: (Array.isArray(dto.items) ? dto.items : []).map(map),
    total: typeof dto.total === "number" ? dto.total : 0,
    page: typeof dto.page === "number" ? dto.page : 1,
    pageSize: typeof dto.page_size === "number" ? dto.page_size : 25,
  };
}

export interface UpdateSettingsInput {
  version: number;
  policy?: PolicyPatch;
  /** Papel → ajuste parcial; `null` remove o ajuste daquele papel. */
  roles?: Partial<Record<TenantRole, PolicyPatch | null>>;
}

export interface NotificationsApi {
  getSettings(): Promise<NotificationSettings>;
  updateSettings(input: UpdateSettingsInput): Promise<NotificationSettings>;
  getMyPreferences(): Promise<MyPreferences>;
  updateMyPreferences(input: UpdateMyPreferencesInput): Promise<MyPreferences>;
  listRecipients(page: number, pageSize?: number): Promise<Page<Recipient>>;
  preview(recipientUserId?: string): Promise<DigestPreview>;
  listDeliveries(
    filters: DeliveryFilters,
    page: number,
    pageSize?: number,
  ): Promise<Page<Delivery>>;
}

class NotificationsApiClient implements NotificationsApi {
  async getSettings(): Promise<NotificationSettings> {
    return toSettings(await apiRequest<Dto>(`${BASE}/settings`));
  }

  async updateSettings(input: UpdateSettingsInput): Promise<NotificationSettings> {
    const body: Dto = { version: input.version };
    if (input.policy) body.policy = input.policy;
    if (input.roles && Object.keys(input.roles).length) body.roles = input.roles;
    return toSettings(await apiRequest<Dto>(`${BASE}/settings`, json("PATCH", body)));
  }

  async getMyPreferences(): Promise<MyPreferences> {
    return toPreferences(await apiRequest<Dto>(`${BASE}/preferences/me`));
  }

  async updateMyPreferences(input: UpdateMyPreferencesInput): Promise<MyPreferences> {
    const body: Dto = { version: input.version };
    if (input.preferences) body.preferences = input.preferences;
    if (input.resetPreferences) body.reset_preferences = true;
    if (input.timezone !== undefined) body.timezone = input.timezone;
    if (input.whatsapp && Object.keys(input.whatsapp).length) body.whatsapp = input.whatsapp;
    return toPreferences(await apiRequest<Dto>(`${BASE}/preferences/me`, json("PATCH", body)));
  }

  async listRecipients(page: number, pageSize = 50): Promise<Page<Recipient>> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    return toPage(await apiRequest<Dto>(`${BASE}/recipients?${params}`), toRecipient);
  }

  async preview(recipientUserId?: string): Promise<DigestPreview> {
    const body: Dto = { kind: "daily_digest" };
    if (recipientUserId) body.recipient_user_id = recipientUserId;
    return toPreview(await apiRequest<Dto>(`${BASE}/preview`, json("POST", body)));
  }

  async listDeliveries(
    filters: DeliveryFilters,
    page: number,
    pageSize = 25,
  ): Promise<Page<Delivery>> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (filters.recipientUserId) params.set("recipient_user_id", filters.recipientUserId);
    if (filters.kind) params.set("kind", filters.kind);
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    return toPage(await apiRequest<Dto>(`${BASE}/deliveries?${params}`), toDelivery);
  }
}

function unavailable(): never {
  throw new NotImplementedError(
    "Notificações",
    "A Central de Notificações não está disponível na demonstração.",
  );
}

const demo: NotificationsApi = {
  getSettings: async () => unavailable(),
  updateSettings: async () => unavailable(),
  getMyPreferences: async () => unavailable(),
  updateMyPreferences: async () => unavailable(),
  listRecipients: async () => unavailable(),
  preview: async () => unavailable(),
  listDeliveries: async () => unavailable(),
};

export const notificationsService: NotificationsApi = selectRepository(
  () => demo,
  () => new NotificationsApiClient(),
);
