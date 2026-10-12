import { apiRequest } from "../repositories/api/ApiClient";
import { NotImplementedError } from "../utils/errors";
import { selectRepository } from "./factory";
import {
  toCalendarChoice,
  toCallbackResult,
  toConnection,
  toDisconnectResult,
  toOverview,
  toPolicy,
  toPublished,
  toSyncRun,
  toTaskListChoice,
} from "../utils/connections";
import type { Page } from "../types/common";
import type {
  CalendarChoice,
  CallbackResult,
  CompanyPolicy,
  Connection,
  ConnectionFeature,
  ConnectionPatch,
  DisconnectResult,
  ProviderId,
  ProvidersOverview,
  PublishedItem,
  PublishEventInput,
  PublishTaskInput,
  SyncRun,
  TaskListChoice,
} from "../types/connections";

/**
 * Conexões Google/Microsoft (CRM-003B.4 a B.6). O navegador NUNCA vê token,
 * segredo ou código de troca: ele só recebe a URL de consentimento e devolve
 * ao backend o que o provedor mandou de volta. Autorização, escopo e
 * isolamento por usuário/empresa são do backend.
 */

type Dto = Record<string, unknown>;
const BASE = "/api/v1/connections";

function json(method: string, body: unknown, headers?: Record<string, string>): RequestInit {
  return { method, body: JSON.stringify(body), ...(headers ? { headers } : {}) };
}

export interface CompleteAuthorizationInput {
  state: string;
  code?: string;
  error?: string;
  errorDescription?: string;
}

export interface ConnectionsApi {
  overview(): Promise<ProvidersOverview>;
  updatePolicy(googleAllowed: boolean, microsoftAllowed: boolean): Promise<CompanyPolicy>;
  list(): Promise<Connection[]>;
  /** Devolve a URL de consentimento do provedor (o app redireciona o navegador). */
  authorize(provider: ProviderId, features: ConnectionFeature[]): Promise<string>;
  completeAuthorization(
    provider: ProviderId,
    input: CompleteAuthorizationInput,
  ): Promise<CallbackResult>;
  update(connectionId: string, patch: ConnectionPatch): Promise<Connection>;
  disconnect(connectionId: string, purgeImported: boolean): Promise<DisconnectResult>;
  calendars(connectionId: string): Promise<CalendarChoice[]>;
  taskLists(connectionId: string): Promise<TaskListChoice[]>;
  syncNow(connectionId: string): Promise<Connection>;
  syncRuns(connectionId: string, page: number): Promise<Page<SyncRun>>;
  publishEvent(input: PublishEventInput): Promise<PublishedItem>;
  publishTask(input: PublishTaskInput): Promise<PublishedItem>;
  retryPublish(kind: "event" | "task", itemId: string): Promise<PublishedItem>;
}

class ConnectionsApiClient implements ConnectionsApi {
  async overview(): Promise<ProvidersOverview> {
    return toOverview(await apiRequest<Dto>(`${BASE}/providers`));
  }

  async updatePolicy(googleAllowed: boolean, microsoftAllowed: boolean): Promise<CompanyPolicy> {
    const dto = await apiRequest<Dto>(
      `${BASE}/policy`,
      json("PUT", { google_allowed: googleAllowed, microsoft_allowed: microsoftAllowed }),
    );
    return toPolicy(dto);
  }

  async list(): Promise<Connection[]> {
    const dtos = await apiRequest<unknown[]>(BASE);
    return (Array.isArray(dtos) ? dtos : []).map(toConnection);
  }

  async authorize(provider: ProviderId, features: ConnectionFeature[]): Promise<string> {
    const dto = await apiRequest<Dto>(`${BASE}/${provider}/authorize`, json("POST", { features }));
    return typeof dto.authorization_url === "string" ? dto.authorization_url : "";
  }

  async completeAuthorization(
    provider: ProviderId,
    input: CompleteAuthorizationInput,
  ): Promise<CallbackResult> {
    const body: Dto = { state: input.state };
    if (input.code) body.code = input.code;
    if (input.error) body.error = input.error;
    if (input.errorDescription) body.error_description = input.errorDescription;
    return toCallbackResult(
      await apiRequest<Dto>(`${BASE}/${provider}/callback`, json("POST", body)),
    );
  }

  async update(connectionId: string, patch: ConnectionPatch): Promise<Connection> {
    const body: Dto = {};
    if (patch.calendarEnabled !== undefined) body.calendar_enabled = patch.calendarEnabled;
    if (patch.tasksEnabled !== undefined) body.tasks_enabled = patch.tasksEnabled;
    if (patch.automaticSyncEnabled !== undefined) {
      body.automatic_sync_enabled = patch.automaticSyncEnabled;
    }
    if (patch.manualSyncEnabled !== undefined) body.manual_sync_enabled = patch.manualSyncEnabled;
    if (patch.calendarIds !== undefined) body.calendar_ids = patch.calendarIds;
    if (patch.taskListIds !== undefined) body.task_list_ids = patch.taskListIds;
    return toConnection(await apiRequest<Dto>(`${BASE}/${connectionId}`, json("PATCH", body)));
  }

  async disconnect(connectionId: string, purgeImported: boolean): Promise<DisconnectResult> {
    const query = purgeImported ? "?purge_imported=true" : "";
    return toDisconnectResult(
      await apiRequest<Dto>(`${BASE}/${connectionId}${query}`, { method: "DELETE" }),
    );
  }

  async calendars(connectionId: string): Promise<CalendarChoice[]> {
    const dtos = await apiRequest<unknown[]>(`${BASE}/${connectionId}/calendars`);
    return (Array.isArray(dtos) ? dtos : []).map(toCalendarChoice);
  }

  async taskLists(connectionId: string): Promise<TaskListChoice[]> {
    const dtos = await apiRequest<unknown[]>(`${BASE}/${connectionId}/task-lists`);
    return (Array.isArray(dtos) ? dtos : []).map(toTaskListChoice);
  }

  async syncNow(connectionId: string): Promise<Connection> {
    return toConnection(await apiRequest<Dto>(`${BASE}/${connectionId}/sync`, json("POST", {})));
  }

  async syncRuns(connectionId: string, page: number): Promise<Page<SyncRun>> {
    const dto = await apiRequest<Dto>(
      `${BASE}/${connectionId}/sync-runs?page=${page}&page_size=10`,
    );
    return {
      items: (Array.isArray(dto.items) ? dto.items : []).map(toSyncRun),
      total: typeof dto.total === "number" ? dto.total : 0,
      page: typeof dto.page === "number" ? dto.page : 1,
      pageSize: typeof dto.page_size === "number" ? dto.page_size : 10,
    };
  }

  async publishEvent(input: PublishEventInput): Promise<PublishedItem> {
    const body: Dto = {
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    };
    if (input.calendarId) body.calendar_id = input.calendarId;
    if (input.leadId) body.lead_id = input.leadId;
    if (input.description) body.description = input.description;
    return toPublished(
      await apiRequest<Dto>(
        `${BASE}/${input.connectionId}/events`,
        json("POST", body, { "Idempotency-Key": input.idempotencyKey }),
      ),
    );
  }

  async publishTask(input: PublishTaskInput): Promise<PublishedItem> {
    const body: Dto = { title: input.title };
    if (input.taskListId) body.task_list_id = input.taskListId;
    if (input.leadId) body.lead_id = input.leadId;
    if (input.dueDate) body.due_date = input.dueDate;
    if (input.dueAt) body.due_at = input.dueAt;
    if (input.notes) body.notes = input.notes;
    return toPublished(
      await apiRequest<Dto>(
        `${BASE}/${input.connectionId}/tasks`,
        json("POST", body, { "Idempotency-Key": input.idempotencyKey }),
      ),
    );
  }

  async retryPublish(kind: "event" | "task", itemId: string): Promise<PublishedItem> {
    return toPublished(
      await apiRequest<Dto>(`${BASE}/items/${kind}/${itemId}/retry`, { method: "POST" }),
    );
  }
}

function unavailable(): never {
  throw new NotImplementedError(
    "Conexões",
    "As conexões com Google e Microsoft não estão disponíveis na demonstração.",
  );
}

const demo: ConnectionsApi = {
  overview: async () => unavailable(),
  updatePolicy: async () => unavailable(),
  list: async () => unavailable(),
  authorize: async () => unavailable(),
  completeAuthorization: async () => unavailable(),
  update: async () => unavailable(),
  disconnect: async () => unavailable(),
  calendars: async () => unavailable(),
  taskLists: async () => unavailable(),
  syncNow: async () => unavailable(),
  syncRuns: async () => unavailable(),
  publishEvent: async () => unavailable(),
  publishTask: async () => unavailable(),
  retryPublish: async () => unavailable(),
};

export const connectionsService: ConnectionsApi = selectRepository(
  () => demo,
  () => new ConnectionsApiClient(),
);
