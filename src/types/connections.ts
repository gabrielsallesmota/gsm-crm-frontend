export type ProviderId = "google" | "microsoft";
export type ConnectionFeature = "calendar" | "tasks";

/** Origem de um compromisso/tarefa na agenda unificada. */
export type ItemSource = "crm" | ProviderId;

export interface ProviderInfo {
  provider: ProviderId;
  label: string;
  /** A GSM tem credencial deste provedor neste ambiente? */
  configured: boolean;
  /** A empresa permite este provedor? */
  allowed: boolean;
  features: ConnectionFeature[];
}

export interface CompanyPolicy {
  googleAllowed: boolean;
  microsoftAllowed: boolean;
  persisted: boolean;
}

export interface ProvidersOverview {
  providers: ProviderInfo[];
  policy: CompanyPolicy;
}

export interface Selection {
  id: string;
  name: string;
}

export type ConnectionStatus = "active" | "needs_reconnect" | string;
export type SyncStatus = "waiting" | "running" | "succeeded" | "failed" | "reconnect_required";

export interface Connection {
  id: string;
  provider: ProviderId;
  accountEmail: string | null;
  status: ConnectionStatus;
  needsReconnect: boolean;
  calendarEnabled: boolean;
  tasksEnabled: boolean;
  automaticSyncEnabled: boolean;
  manualSyncEnabled: boolean;
  intervalMinutes: number;
  selectedCalendars: Selection[];
  selectedTaskLists: Selection[];
  syncStatus: SyncStatus;
  lastSyncFinishedAt: string | null;
  lastSuccessAt: string | null;
  nextSyncAt: string | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface CalendarChoice {
  id: string;
  name: string;
  primary: boolean;
  writable: boolean;
  selected: boolean;
}

export interface TaskListChoice {
  id: string;
  name: string;
  selected: boolean;
}

export interface CallbackResult {
  connection: Connection;
  /** Funcionalidades pedidas cujo acesso o usuário NÃO concedeu. */
  missingFeatures: ConnectionFeature[];
}

export interface ConnectionPatch {
  calendarEnabled?: boolean;
  tasksEnabled?: boolean;
  automaticSyncEnabled?: boolean;
  manualSyncEnabled?: boolean;
  calendarIds?: string[];
  taskListIds?: string[];
}

export interface SyncRun {
  id: string;
  trigger: string;
  scope: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  counts: Record<string, number>;
  errorMessage: string | null;
}

export interface DisconnectResult {
  /** `null` = o provedor não oferece revogação (Microsoft). */
  providerRevoked: boolean | null;
  purgedEvents: number;
  purgedTasks: number;
}

export interface PublishedItem {
  kind: "event" | "task";
  itemId: string;
  externalUrl: string | null;
  pushStatus: "pushed" | "failed";
  errorMessage: string | null;
}

export interface PublishEventInput {
  connectionId: string;
  calendarId?: string;
  leadId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  /** Mesma chave = mesma criação (repetir não duplica). */
  idempotencyKey: string;
}

export interface PublishTaskInput {
  connectionId: string;
  taskListId?: string;
  leadId?: string;
  title: string;
  /** Data local (AAAA-MM-DD) — Google Tasks guarda só o dia. */
  dueDate?: string;
  dueAt?: string;
  notes?: string;
  idempotencyKey: string;
}
