import { apiRequest } from "./ApiClient";
import {
  toClient,
  toHistoryPage,
  toProcedure,
  toTherapist,
  type ClientDto,
  type HistoryPageDto,
  type ProcedureDto,
  type TherapistDto,
} from "./operationsMapping";
import type {
  CreateProcedureInput,
  CreateTherapistInput,
  HistoryFilter,
  HistoryPage,
  OperationsClient,
  Procedure,
  Therapist,
  UpdateProcedureInput,
  UpdateTherapistInput,
} from "../../types/operations";

const BASE = "/api/v1/operations";

/**
 * CRUD administrativo de "Terapeuta da Vez" — terapeutas, procedimentos,
 * clientes e histórico. Exige login no CRM (`apiRequest` manda o Bearer
 * token normalmente); diferente do painel público, que fala direto com
 * `/api/v1/public/terapeuta-da-vez` sem autenticação (ver
 * `TerapeutaDaVezPublicRepository`).
 */
export class OperationsApiRepository {
  listTherapists(onlyActive = false): Promise<Therapist[]> {
    return apiRequest<TherapistDto[]>(`${BASE}/therapists?only_active=${onlyActive}`).then((items) =>
      items.map(toTherapist),
    );
  }

  createTherapist(input: CreateTherapistInput): Promise<Therapist> {
    return apiRequest<TherapistDto>(`${BASE}/therapists`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then(toTherapist);
  }

  updateTherapist(id: string, input: UpdateTherapistInput): Promise<Therapist> {
    return apiRequest<TherapistDto>(`${BASE}/therapists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then(toTherapist);
  }

  deleteTherapist(id: string): Promise<void> {
    return apiRequest<void>(`${BASE}/therapists/${id}`, { method: "DELETE" });
  }

  listProcedures(onlyActive = false): Promise<Procedure[]> {
    return apiRequest<ProcedureDto[]>(`${BASE}/procedures?only_active=${onlyActive}`).then((items) =>
      items.map(toProcedure),
    );
  }

  createProcedure(input: CreateProcedureInput): Promise<Procedure> {
    return apiRequest<ProcedureDto>(`${BASE}/procedures`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then(toProcedure);
  }

  updateProcedure(id: string, input: UpdateProcedureInput): Promise<Procedure> {
    return apiRequest<ProcedureDto>(`${BASE}/procedures/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then(toProcedure);
  }

  deleteProcedure(id: string): Promise<void> {
    return apiRequest<void>(`${BASE}/procedures/${id}`, { method: "DELETE" });
  }

  listClients(search?: string): Promise<OperationsClient[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiRequest<ClientDto[]>(`${BASE}/clients${qs}`).then((items) => items.map(toClient));
  }

  createClient(name: string, phone: string): Promise<OperationsClient> {
    return apiRequest<ClientDto>(`${BASE}/clients`, {
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
    const dto = await apiRequest<HistoryPageDto>(`${BASE}/attendances?${params.toString()}`);
    return toHistoryPage(dto);
  }
}

export const operationsApiRepository = new OperationsApiRepository();
