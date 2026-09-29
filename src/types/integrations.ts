/** Configurações → Integrações (Etapa 3). Espelha
 * `/api/v1/integrations/*` do backend. Nenhum tipo aqui carrega hash ou
 * secret — o secret só existe em `CreatedCredential.fullKey` /
 * `WebhookWithSecret.secret`, UMA vez, na resposta de criação/rotação. */

export interface ApiScopeDefinition {
  scope: string;
  label: string;
  endpoints: string[];
}

export type CredentialStatus = "active" | "revoked";

export interface ApiCredential {
  id: string;
  name: string;
  /** Identificador público estável (não muda na rotação). */
  clientId: string;
  environment: string;
  status: CredentialStatus;
  expired: boolean;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  rotatedAt: string | null;
  /** Durante a janela de rotação o secret anterior ainda vale até aqui. */
  previousSecretValidUntil: string | null;
}

export interface CreatedCredential {
  credential: ApiCredential;
  /** `client_id.secret` — mostrado uma única vez. */
  fullKey: string;
}

export interface CreateCredentialInput {
  name: string;
  scopes: string[];
  expiresAt: string | null;
}

export interface WebhookEventDefinition {
  type: string;
  description: string;
}

export type WebhookStatus = "active" | "paused" | "disabled";

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  status: WebhookStatus;
  /** Últimos 4 caracteres do secret — só para conferência. */
  secretHint: string;
  consecutiveFailures: number;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryStatusCode: number | null;
}

export interface WebhookWithSecret {
  endpoint: WebhookEndpoint;
  secret: string;
}

export interface WebhookInput {
  url: string;
  events: string[];
  description: string | null;
}

export type DeliveryStatus = "pending" | "delivering" | "succeeded" | "retrying" | "failed";

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  lastDurationMs: number | null;
  createdAt: string;
  deliveredAt: string | null;
}

export type AttemptOutcome = "success" | "http_error" | "timeout" | "connection_error" | "blocked";

export interface DeliveryAttempt {
  attempt: number;
  startedAt: string;
  durationMs: number | null;
  statusCode: number | null;
  outcome: AttemptOutcome;
  error: string | null;
  responseExcerpt: string | null;
}

export interface WebhookDeliveryDetail extends WebhookDelivery {
  payload: Record<string, unknown>;
  history: DeliveryAttempt[];
}
