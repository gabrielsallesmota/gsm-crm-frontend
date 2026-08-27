import { ApiError } from "../../types/common";
import { BASE_URL } from "./ApiClient";
import { getOperationsPassword } from "./operationsAuth";
import {
  toClient,
  toHistoryPage,
  toProcedure,
  toSpaceAdmin,
  toTherapist,
  toTherapistPoints,
  type ClientDto,
  type HistoryPageDto,
  type ProcedureDto,
  type SpaceAdminDto,
  type TherapistDto,
  type TherapistPointsDto,
} from "./operationsMapping";
import type {
  CreateProcedureInput,
  CreateSpaceInput,
  CreateTherapistInput,
  HistoryFilter,
  HistoryPage,
  OperationsClient,
  Procedure,
  SpaceAdmin,
  Therapist,
  TherapistPoints,
  UpdateProcedureInput,
  UpdateSpaceInput,
  UpdateTherapistInput,
} from "../../types/operations";

const BASE = "/api/v1/operations";

async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : "Erro ao comunicar com o servidor.";
  } catch {
    return "Erro ao comunicar com o servidor.";
  }
}

/**
 * Cliente HTTP próprio (não usa `apiRequest`/Bearer do CRM) — a gestão de
 * "Terapeuta da Vez" é protegida por uma senha simples compartilhada
 * (header `X-Operations-Password`), não pelo login do CRM (ver
 * `operationsAuth.ts` e o backend `require_operations_access`).
 */
async function operationsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const password = getOperationsPassword();
  if (password) headers.set("X-Operations-Password", password);
  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!resp.ok) throw new ApiError(resp.status, await readErrorDetail(resp));
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

/** camelCase -> snake_case explícito nos corpos de request (o backend não
 * tem alias de camelCase nos schemas Pydantic) — mesma convenção usada em
 * `LeadsApiRepository`. */
function therapistBody(input: CreateTherapistInput | UpdateTherapistInput) {
  return { code: input.code, name: input.name, active: input.active };
}

function procedureBody(input: CreateProcedureInput | UpdateProcedureInput) {
  return {
    code: input.code,
    name: input.name,
    points: input.points,
    price_label: input.priceLabel,
    space_requirements: input.spaceRequirements?.map((r) => ({ type: r.type, minutes: r.minutes })),
    category: input.category,
    active: input.active,
  };
}

function spaceBody(input: CreateSpaceInput | UpdateSpaceInput) {
  return { code: input.code, name: input.name, type: input.type, active: input.active };
}

export class OperationsApiRepository {
  listTherapists(onlyActive = false): Promise<Therapist[]> {
    return operationsRequest<TherapistDto[]>(`${BASE}/therapists?only_active=${onlyActive}`).then(
      (items) => items.map(toTherapist),
    );
  }

  createTherapist(input: CreateTherapistInput): Promise<Therapist> {
    return operationsRequest<TherapistDto>(`${BASE}/therapists`, {
      method: "POST",
      body: JSON.stringify(therapistBody(input)),
    }).then(toTherapist);
  }

  updateTherapist(id: string, input: UpdateTherapistInput): Promise<Therapist> {
    return operationsRequest<TherapistDto>(`${BASE}/therapists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(therapistBody(input)),
    }).then(toTherapist);
  }

  deleteTherapist(id: string): Promise<void> {
    return operationsRequest<void>(`${BASE}/therapists/${id}`, { method: "DELETE" });
  }

  getTherapistPoints(id: string, isoDate: string): Promise<TherapistPoints> {
    return operationsRequest<TherapistPointsDto>(
      `${BASE}/therapists/${id}/points?on_date=${isoDate}`,
    ).then(toTherapistPoints);
  }

  listProcedures(onlyActive = false): Promise<Procedure[]> {
    return operationsRequest<ProcedureDto[]>(`${BASE}/procedures?only_active=${onlyActive}`).then(
      (items) => items.map(toProcedure),
    );
  }

  createProcedure(input: CreateProcedureInput): Promise<Procedure> {
    return operationsRequest<ProcedureDto>(`${BASE}/procedures`, {
      method: "POST",
      body: JSON.stringify(procedureBody(input)),
    }).then(toProcedure);
  }

  updateProcedure(id: string, input: UpdateProcedureInput): Promise<Procedure> {
    return operationsRequest<ProcedureDto>(`${BASE}/procedures/${id}`, {
      method: "PATCH",
      body: JSON.stringify(procedureBody(input)),
    }).then(toProcedure);
  }

  deleteProcedure(id: string): Promise<void> {
    return operationsRequest<void>(`${BASE}/procedures/${id}`, { method: "DELETE" });
  }

  listSpaces(onlyActive = false): Promise<SpaceAdmin[]> {
    return operationsRequest<SpaceAdminDto[]>(`${BASE}/spaces?only_active=${onlyActive}`).then((items) =>
      items.map(toSpaceAdmin),
    );
  }

  createSpace(input: CreateSpaceInput): Promise<SpaceAdmin> {
    return operationsRequest<SpaceAdminDto>(`${BASE}/spaces`, {
      method: "POST",
      body: JSON.stringify(spaceBody(input)),
    }).then(toSpaceAdmin);
  }

  updateSpace(id: string, input: UpdateSpaceInput): Promise<SpaceAdmin> {
    return operationsRequest<SpaceAdminDto>(`${BASE}/spaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(spaceBody(input)),
    }).then(toSpaceAdmin);
  }

  deleteSpace(id: string): Promise<void> {
    return operationsRequest<void>(`${BASE}/spaces/${id}`, { method: "DELETE" });
  }

  listClients(search?: string): Promise<OperationsClient[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return operationsRequest<ClientDto[]>(`${BASE}/clients${qs}`).then((items) => items.map(toClient));
  }

  createClient(name: string, phone: string): Promise<OperationsClient> {
    return operationsRequest<ClientDto>(`${BASE}/clients`, {
      method: "POST",
      body: JSON.stringify({ name, phone }),
    }).then(toClient);
  }

  async listHistory(filter: HistoryFilter): Promise<HistoryPage> {
    const params = new URLSearchParams();
    if (filter.therapistId) params.set("therapist_id", filter.therapistId);
    if (filter.procedureId) params.set("procedure_id", filter.procedureId);
    if (filter.clientSearch) params.set("client_search", filter.clientSearch);
    if (filter.phase) params.set("phase", filter.phase);
    if (filter.dateFrom) params.set("date_from", filter.dateFrom);
    if (filter.dateTo) params.set("date_to", filter.dateTo);
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 20));
    const dto = await operationsRequest<HistoryPageDto>(`${BASE}/attendances?${params.toString()}`);
    return toHistoryPage(dto);
  }
}

export const operationsApiRepository = new OperationsApiRepository();
