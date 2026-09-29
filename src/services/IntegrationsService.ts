import { apiRequest } from "../repositories/api/ApiClient";
import { NotImplementedError } from "../utils/errors";
import { selectRepository } from "./factory";
import type { Page } from "../types/common";
import type {
  ApiCredential,
  ApiScopeDefinition,
  CreateCredentialInput,
  CreatedCredential,
  DeliveryAttempt,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookEndpoint,
  WebhookEventDefinition,
  WebhookInput,
  WebhookStatus,
  WebhookWithSecret,
} from "../types/integrations";

/**
 * Configurações → Integrações (Etapa 3): credenciais da API pública e
 * webhooks de saída. Só API real — na demonstração a tela mostra que não
 * está disponível. Autorização: backend (Admin do tenant + feature `api` /
 * `webhooks`; sessão de suporte não cria nem rotaciona segredos).
 */

type Dto = Record<string, unknown>;
const BASE = "/api/v1/integrations";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function toCredential(d: Dto): ApiCredential {
  return {
    id: str(d.id),
    name: str(d.name),
    clientId: str(d.client_id) || str(d.key_prefix),
    environment: str(d.environment),
    status: d.status === "revoked" ? "revoked" : "active",
    expired: d.expired === true,
    scopes: strings(d.scopes),
    createdAt: str(d.created_at),
    revokedAt: strOrNull(d.revoked_at),
    lastUsedAt: strOrNull(d.last_used_at),
    lastUsedIp: strOrNull(d.last_used_ip),
    expiresAt: strOrNull(d.expires_at),
    rotatedAt: strOrNull(d.rotated_at),
    previousSecretValidUntil: strOrNull(d.previous_secret_valid_until),
  };
}

function toCreated(d: Dto): CreatedCredential {
  return { credential: toCredential(d), fullKey: str(d.full_key) };
}

function toEndpoint(d: Dto): WebhookEndpoint {
  const status = str(d.status);
  return {
    id: str(d.id),
    url: str(d.url),
    description: strOrNull(d.description),
    events: strings(d.events),
    status: status === "paused" || status === "disabled" ? status : "active",
    secretHint: str(d.secret_hint),
    consecutiveFailures: numOrNull(d.consecutive_failures) ?? 0,
    disabledReason: strOrNull(d.disabled_reason),
    createdAt: str(d.created_at),
    updatedAt: str(d.updated_at),
    lastDeliveryAt: strOrNull(d.last_delivery_at),
    lastDeliveryStatus: strOrNull(d.last_delivery_status),
    lastDeliveryStatusCode: numOrNull(d.last_delivery_status_code),
  };
}

function toWithSecret(d: Dto): WebhookWithSecret {
  return { endpoint: toEndpoint((d.endpoint ?? {}) as Dto), secret: str(d.secret) };
}

function toDelivery(d: Dto): WebhookDelivery {
  return {
    id: str(d.id),
    endpointId: str(d.endpoint_id),
    eventId: str(d.event_id),
    eventType: str(d.event_type),
    status: str(d.status) as WebhookDelivery["status"],
    attempts: numOrNull(d.attempts) ?? 0,
    maxAttempts: numOrNull(d.max_attempts) ?? 0,
    nextAttemptAt: str(d.next_attempt_at),
    lastAttemptAt: strOrNull(d.last_attempt_at),
    lastStatusCode: numOrNull(d.last_status_code),
    lastError: strOrNull(d.last_error),
    lastDurationMs: numOrNull(d.last_duration_ms),
    createdAt: str(d.created_at),
    deliveredAt: strOrNull(d.delivered_at),
  };
}

function toAttempt(d: Dto): DeliveryAttempt {
  return {
    attempt: numOrNull(d.attempt) ?? 0,
    startedAt: str(d.started_at),
    durationMs: numOrNull(d.duration_ms),
    statusCode: numOrNull(d.status_code),
    outcome: str(d.outcome) as DeliveryAttempt["outcome"],
    error: strOrNull(d.error),
    responseExcerpt: strOrNull(d.response_excerpt),
  };
}

function toDetail(d: Dto): WebhookDeliveryDetail {
  const history = Array.isArray(d.history) ? (d.history as Dto[]) : [];
  return {
    ...toDelivery(d),
    payload: (d.payload ?? {}) as Record<string, unknown>,
    history: history.map(toAttempt),
  };
}

function json(method: string, body?: unknown): RequestInit {
  return body === undefined ? { method } : { method, body: JSON.stringify(body) };
}

export interface IntegrationsApi {
  scopes(): Promise<ApiScopeDefinition[]>;
  listCredentials(): Promise<ApiCredential[]>;
  createCredential(input: CreateCredentialInput): Promise<CreatedCredential>;
  rotateCredential(id: string, gracePeriodHours: number): Promise<CreatedCredential>;
  revokeCredential(id: string): Promise<void>;
  events(): Promise<WebhookEventDefinition[]>;
  listWebhooks(): Promise<WebhookEndpoint[]>;
  createWebhook(input: WebhookInput): Promise<WebhookWithSecret>;
  updateWebhook(
    id: string,
    changes: Partial<WebhookInput> & { status?: WebhookStatus },
  ): Promise<WebhookEndpoint>;
  deleteWebhook(id: string): Promise<void>;
  rotateWebhookSecret(id: string): Promise<WebhookWithSecret>;
  sendTest(id: string): Promise<WebhookDelivery>;
  listDeliveries(id: string, status: string | null, page: number): Promise<Page<WebhookDelivery>>;
  getDelivery(id: string): Promise<WebhookDeliveryDetail>;
  redeliver(id: string): Promise<WebhookDelivery>;
}

class IntegrationsApiClient implements IntegrationsApi {
  async scopes(): Promise<ApiScopeDefinition[]> {
    const dtos = await apiRequest<Dto[]>(`${BASE}/scopes`);
    return dtos.map((d) => ({ scope: str(d.scope), label: str(d.label), endpoints: strings(d.endpoints) }));
  }

  async listCredentials(): Promise<ApiCredential[]> {
    return (await apiRequest<Dto[]>(`${BASE}/credentials`)).map(toCredential);
  }

  async createCredential(input: CreateCredentialInput): Promise<CreatedCredential> {
    const dto = await apiRequest<Dto>(
      `${BASE}/credentials`,
      json("POST", { name: input.name.trim(), scopes: input.scopes, expires_at: input.expiresAt }),
    );
    return toCreated(dto);
  }

  async rotateCredential(id: string, gracePeriodHours: number): Promise<CreatedCredential> {
    const dto = await apiRequest<Dto>(
      `${BASE}/credentials/${id}/rotate`,
      json("POST", { grace_period_hours: gracePeriodHours }),
    );
    return toCreated(dto);
  }

  async revokeCredential(id: string): Promise<void> {
    await apiRequest<void>(`${BASE}/credentials/${id}`, json("DELETE"));
  }

  async events(): Promise<WebhookEventDefinition[]> {
    const dtos = await apiRequest<Dto[]>(`${BASE}/webhooks/events`);
    return dtos.map((d) => ({ type: str(d.type), description: str(d.description) }));
  }

  async listWebhooks(): Promise<WebhookEndpoint[]> {
    return (await apiRequest<Dto[]>(`${BASE}/webhooks`)).map(toEndpoint);
  }

  async createWebhook(input: WebhookInput): Promise<WebhookWithSecret> {
    const dto = await apiRequest<Dto>(
      `${BASE}/webhooks`,
      json("POST", { url: input.url.trim(), events: input.events, description: input.description }),
    );
    return toWithSecret(dto);
  }

  async updateWebhook(
    id: string,
    changes: Partial<WebhookInput> & { status?: WebhookStatus },
  ): Promise<WebhookEndpoint> {
    return toEndpoint(await apiRequest<Dto>(`${BASE}/webhooks/${id}`, json("PATCH", changes)));
  }

  async deleteWebhook(id: string): Promise<void> {
    await apiRequest<void>(`${BASE}/webhooks/${id}`, json("DELETE"));
  }

  async rotateWebhookSecret(id: string): Promise<WebhookWithSecret> {
    return toWithSecret(await apiRequest<Dto>(`${BASE}/webhooks/${id}/rotate-secret`, json("POST")));
  }

  async sendTest(id: string): Promise<WebhookDelivery> {
    return toDelivery(await apiRequest<Dto>(`${BASE}/webhooks/${id}/test`, json("POST")));
  }

  async listDeliveries(
    id: string,
    status: string | null,
    page: number,
  ): Promise<Page<WebhookDelivery>> {
    const qs = new URLSearchParams({ page: String(page), page_size: "20" });
    if (status) qs.set("status", status);
    const dto = await apiRequest<Dto>(`${BASE}/webhooks/${id}/deliveries?${qs.toString()}`);
    const items = Array.isArray(dto.items) ? (dto.items as Dto[]) : [];
    return {
      items: items.map(toDelivery),
      total: numOrNull(dto.total) ?? 0,
      page: numOrNull(dto.page) ?? page,
      pageSize: numOrNull(dto.page_size) ?? 20,
    };
  }

  async getDelivery(id: string): Promise<WebhookDeliveryDetail> {
    return toDetail(await apiRequest<Dto>(`${BASE}/webhooks/deliveries/${id}`));
  }

  async redeliver(id: string): Promise<WebhookDelivery> {
    return toDelivery(
      await apiRequest<Dto>(`${BASE}/webhooks/deliveries/${id}/redeliver`, json("POST")),
    );
  }
}

function unavailable(): never {
  throw new NotImplementedError(
    "Integrações",
    "Integrações (API e webhooks) não estão disponíveis na demonstração.",
  );
}

const demo: IntegrationsApi = {
  scopes: async () => unavailable(),
  listCredentials: async () => unavailable(),
  createCredential: async () => unavailable(),
  rotateCredential: async () => unavailable(),
  revokeCredential: async () => unavailable(),
  events: async () => unavailable(),
  listWebhooks: async () => unavailable(),
  createWebhook: async () => unavailable(),
  updateWebhook: async () => unavailable(),
  deleteWebhook: async () => unavailable(),
  rotateWebhookSecret: async () => unavailable(),
  sendTest: async () => unavailable(),
  listDeliveries: async () => unavailable(),
  getDelivery: async () => unavailable(),
  redeliver: async () => unavailable(),
};

export const integrationsService: IntegrationsApi = selectRepository(
  () => demo,
  () => new IntegrationsApiClient(),
);
