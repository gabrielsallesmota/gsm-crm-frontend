// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
/**
 * Conexões Google/Microsoft (CRM-003B.4 a B.6) — regras PURAS do frontend:
 * mapeamento DTO → tipos, leitura segura do retorno do OAuth, rótulos e
 * `mailto:`. Quem autoriza, valida e sincroniza é sempre o backend; nada aqui
 * guarda token ou segredo.
 */
import { ApiError } from "../types/common.ts";
import { describeError } from "./apiErrors.ts";
import type {
  CalendarChoice,
  CallbackResult,
  CompanyPolicy,
  Connection,
  ConnectionFeature,
  DisconnectResult,
  ItemSource,
  ProviderId,
  ProviderInfo,
  ProvidersOverview,
  PublishedItem,
  Selection,
  SyncRun,
  SyncStatus,
  TaskListChoice,
} from "../types/connections.ts";

type Dto = Record<string, unknown>;

function obj(v: unknown): Dto {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Dto) : {};
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}
function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function isProvider(v: unknown): v is ProviderId {
  return v === "google" || v === "microsoft";
}

function features(v: unknown): ConnectionFeature[] {
  return list(v).filter((f): f is ConnectionFeature => f === "calendar" || f === "tasks");
}

function selections(v: unknown): Selection[] {
  return list(v).map((s) => ({ id: str(obj(s).id), name: str(obj(s).name) }));
}

const SYNC_STATUSES: SyncStatus[] = ["waiting", "running", "succeeded", "failed", "reconnect_required"];

export function toConnection(raw: unknown): Connection {
  const d = obj(raw);
  const sync = str(d.sync_status);
  return {
    id: str(d.id),
    provider: isProvider(d.provider) ? d.provider : "google",
    accountEmail: strOrNull(d.account_email),
    status: str(d.status, "active"),
    needsReconnect: d.needs_reconnect === true,
    calendarEnabled: d.calendar_enabled === true,
    tasksEnabled: d.tasks_enabled === true,
    automaticSyncEnabled: d.automatic_sync_enabled === true,
    manualSyncEnabled: d.manual_sync_enabled === true,
    intervalMinutes: num(d.interval_minutes, 15),
    selectedCalendars: selections(d.selected_calendars),
    selectedTaskLists: selections(d.selected_task_lists),
    syncStatus: (SYNC_STATUSES as string[]).includes(sync) ? (sync as SyncStatus) : "waiting",
    lastSyncFinishedAt: strOrNull(d.last_sync_finished_at),
    lastSuccessAt: strOrNull(d.last_success_at),
    nextSyncAt: strOrNull(d.next_sync_at),
    consecutiveFailures: num(d.consecutive_failures),
    lastErrorCode: strOrNull(d.last_error_code),
    lastErrorMessage: strOrNull(d.last_error_message),
  };
}

export function toProviderInfo(raw: unknown): ProviderInfo {
  const d = obj(raw);
  return {
    provider: isProvider(d.provider) ? d.provider : "google",
    label: str(d.label),
    configured: d.configured === true,
    allowed: d.allowed === true,
    features: features(d.features),
  };
}

export function toPolicy(raw: unknown): CompanyPolicy {
  const d = obj(raw);
  return {
    googleAllowed: d.google_allowed !== false,
    microsoftAllowed: d.microsoft_allowed !== false,
    persisted: d.persisted === true,
  };
}

export function toOverview(raw: unknown): ProvidersOverview {
  const d = obj(raw);
  return {
    providers: list(d.providers).map(toProviderInfo),
    policy: toPolicy(d.policy),
  };
}

export function toCallbackResult(raw: unknown): CallbackResult {
  const d = obj(raw);
  return { connection: toConnection(d.connection), missingFeatures: features(d.missing_features) };
}

export function toCalendarChoice(raw: unknown): CalendarChoice {
  const d = obj(raw);
  return {
    id: str(d.id),
    name: str(d.name),
    primary: d.primary === true,
    writable: d.writable === true,
    selected: d.selected === true,
  };
}

export function toTaskListChoice(raw: unknown): TaskListChoice {
  const d = obj(raw);
  return { id: str(d.id), name: str(d.name), selected: d.selected === true };
}

export function toSyncRun(raw: unknown): SyncRun {
  const d = obj(raw);
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(d.counts))) if (typeof v === "number") counts[k] = v;
  return {
    id: str(d.id),
    trigger: str(d.trigger),
    scope: str(d.scope),
    status: str(d.status),
    startedAt: str(d.started_at),
    finishedAt: strOrNull(d.finished_at),
    counts,
    errorMessage: strOrNull(d.error_message),
  };
}

export function toDisconnectResult(raw: unknown): DisconnectResult {
  const d = obj(raw);
  return {
    providerRevoked: typeof d.provider_revoked === "boolean" ? d.provider_revoked : null,
    purgedEvents: num(d.purged_events),
    purgedTasks: num(d.purged_tasks),
  };
}

export function toPublished(raw: unknown): PublishedItem {
  const d = obj(raw);
  return {
    kind: d.kind === "task" ? "task" : "event",
    itemId: str(d.item_id),
    externalUrl: strOrNull(d.external_url),
    pushStatus: d.push_status === "pushed" ? "pushed" : "failed",
    errorMessage: strOrNull(d.error_message),
  };
}

// ---- retorno do OAuth ----------------------------------------------------------

export interface OAuthReturn {
  state: string | null;
  code: string | null;
  error: string | null;
  errorDescription: string | null;
}

/** Lê o que o provedor devolveu na URL (`?state=&code=` ou `?error=`). */
export function parseOAuthReturn(search: string): OAuthReturn {
  const p = new URLSearchParams(search);
  const clean = (v: string | null) => (v && v.trim() ? v : null);
  return {
    state: clean(p.get("state")),
    code: clean(p.get("code")),
    error: clean(p.get("error")),
    errorDescription: clean(p.get("error_description")),
  };
}

/** O retorno só vale com `state` e (`code` ou `error`). */
export function isUsableOAuthReturn(r: OAuthReturn): boolean {
  return r.state !== null && (r.code !== null || r.error !== null);
}

// ---- rótulos --------------------------------------------------------------------

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

export const PROVIDER_SERVICES: Record<ProviderId, string> = {
  google: "Google Agenda e Google Tarefas",
  microsoft: "Outlook Calendário e Microsoft To Do",
};

export const SOURCE_LABEL: Record<ItemSource, string> = {
  crm: "CRM",
  google: "Google",
  microsoft: "Microsoft",
};

export function sourceLabel(source: string): string {
  return source === "google" || source === "microsoft" || source === "crm"
    ? SOURCE_LABEL[source]
    : "CRM";
}

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  waiting: "Aguardando",
  running: "Sincronizando…",
  succeeded: "Sincronizado",
  failed: "Falhou — nova tentativa automática",
  reconnect_required: "Reconexão necessária",
};

export const FEATURE_LABEL: Record<ConnectionFeature, string> = {
  calendar: "Agenda",
  tasks: "Tarefas",
};

/** O que fazer quando a conexão precisa de atenção (texto acionável). */
export function connectionAttention(c: Connection): string | null {
  if (c.needsReconnect) {
    return "O acesso a esta conta expirou ou foi revogado. Conecte novamente para voltar a sincronizar.";
  }
  if (c.syncStatus === "failed") {
    return c.lastErrorMessage ?? "A última sincronização falhou. Tentaremos de novo automaticamente.";
  }
  return null;
}

/** Há algo selecionado para sincronizar? (o backend recusa sincronizar sem seleção) */
export function hasSelection(c: Connection): boolean {
  return (
    (c.calendarEnabled && c.selectedCalendars.length > 0) ||
    (c.tasksEnabled && c.selectedTaskLists.length > 0)
  );
}

/** Funcionalidades a pedir ao reconectar: as que a conta já usava (ou ambas). */
export function reconnectFeatures(c: Connection): ConnectionFeature[] {
  const used: ConnectionFeature[] = [];
  if (c.calendarEnabled) used.push("calendar");
  if (c.tasksEnabled) used.push("tasks");
  return used.length ? used : ["calendar", "tasks"];
}

export function canSyncNow(c: Connection): boolean {
  return !c.needsReconnect && c.manualSyncEnabled && c.syncStatus !== "running" && hasSelection(c);
}

// ---- e-mail comercial (mailto) --------------------------------------------------

const EMAIL = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]+$/;

export function isValidEmail(value: string | null | undefined): value is string {
  return !!value && value.length <= 254 && EMAIL.test(value.trim());
}

/**
 * Link `mailto:` para o programa de e-mail do próprio usuário. O CRM NUNCA
 * envia nem registra e-mail como "enviado": só abre o rascunho. Devolve
 * `null` para e-mail inválido (inclui tentativas de injetar cabeçalhos).
 */
export function buildMailtoUrl(
  email: string | null | undefined,
  options: { subject?: string; body?: string } = {},
): string | null {
  if (!isValidEmail(email)) return null;
  const params: string[] = [];
  const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
  if (options.subject) params.push(`subject=${encodeURIComponent(clean(options.subject))}`);
  if (options.body) params.push(`body=${encodeURIComponent(options.body.replace(/\r\n?/g, "\n"))}`);
  return `mailto:${encodeURIComponent(email.trim()).replace(/%40/g, "@")}${
    params.length ? `?${params.join("&")}` : ""
  }`;
}

// ---- provedor do retorno (o redirect URI é fixo e não carrega o provedor) --------

const PENDING_PREFIX = "gsm_oauth_provider:";

/** `state` embutido na URL de consentimento devolvida pelo backend. */
export function stateFromAuthorizationUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("state");
  } catch {
    return null;
  }
}

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): KeyValueStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Lembra, só nesta aba, qual provedor iniciou o fluxo daquele `state`. */
export function rememberPendingProvider(
  state: string,
  provider: ProviderId,
  store: KeyValueStore | null = sessionStore(),
): void {
  try {
    store?.setItem(PENDING_PREFIX + state, provider);
  } catch {
    /* sem storage: o retorno mostra a mensagem de reiniciar */
  }
}

export function takePendingProvider(
  state: string,
  store: KeyValueStore | null = sessionStore(),
): ProviderId | null {
  try {
    const found = store?.getItem(PENDING_PREFIX + state) ?? null;
    store?.removeItem(PENDING_PREFIX + state);
    return isProvider(found) ? found : null;
  } catch {
    return null;
  }
}

/** Só links http(s) vindos do provedor viram `<a>` (nada de `javascript:`). */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Contas que podem receber um item novo do tipo pedido: ativas, com a
 * funcionalidade ligada e ao menos um calendário/lista escolhido. */
export function eligibleTargets(connections: Connection[], kind: "event" | "task"): Connection[] {
  return connections.filter((c) =>
    c.needsReconnect
      ? false
      : kind === "event"
        ? c.calendarEnabled && c.selectedCalendars.length > 0
        : c.tasksEnabled && c.selectedTaskLists.length > 0,
  );
}

/**
 * Mensagem de erro das rotas de conexão. Diferente do padrão do app, o 502/503/504
 * mostra o motivo que a API devolve ("a integração não está configurada", "a
 * aplicação foi recusada pelo provedor"...): essas mensagens são escritas para o
 * usuário e nunca carregam segredo — esconder só dificultaria o diagnóstico.
 */
export function describeConnectionError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && [502, 503, 504].includes(err.status) && err.message.trim()) {
    return err.message;
  }
  return describeError(err, fallback);
}
