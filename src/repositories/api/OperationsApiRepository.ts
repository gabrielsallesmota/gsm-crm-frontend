import { ApiError } from "../../types/common";
import { BASE_URL } from "./ApiClient";
import { getOperationsPassword } from "./operationsAuth";
import {
  toAttendance,
  toBusinessHoursEntry,
  toClient,
  toHistoryPage,
  toImportSummary,
  toProcedure,
  toScheduleEntry,
  toShiftHoursEntry,
  toSpaceAdmin,
  toTherapist,
  toTherapistDailyPoints,
  toTherapistPoints,
  type AttendanceDto,
  type BusinessHoursEntryDto,
  type ClientDto,
  type HistoryPageDto,
  type ImportSummaryDto,
  type ProcedureDto,
  type ScheduleEntryDto,
  type ShiftHoursEntryDto,
  type SpaceAdminDto,
  type TherapistDailyPointsDto,
  type TherapistDto,
  type TherapistPointsDto,
} from "./operationsMapping";
import type {
  AttendanceRecord,
  BusinessHoursEntry,
  CreateProcedureInput,
  CreateScheduleEntryInput,
  CreateSpaceInput,
  CreateTherapistInput,
  DedupeStrategy,
  HistoryFilter,
  HistoryPage,
  ImportSummary,
  OperationsClient,
  PaymentAllocationInput,
  Procedure,
  ProcedureImportRowInput,
  ScheduleEntry,
  ScheduleImportRowInput,
  ShiftHoursEntry,
  SpaceAdmin,
  Therapist,
  TherapistDailyPoints,
  TherapistImportRowInput,
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

/** Variante que devolve texto cru (CSV de export), não JSON — mesma senha,
 * mesmo tratamento de erro. */
async function operationsRequestText(path: string): Promise<string> {
  const headers = new Headers();
  const password = getOperationsPassword();
  if (password) headers.set("X-Operations-Password", password);
  const resp = await fetch(`${BASE_URL}${path}`, { headers });
  if (!resp.ok) throw new ApiError(resp.status, await readErrorDetail(resp));
  return resp.text();
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
    price: input.price,
    space_requirements: input.spaceRequirements?.map((r) => ({ type: r.type, minutes: r.minutes })),
    category: input.category,
    active: input.active,
  };
}

function spaceBody(input: CreateSpaceInput | UpdateSpaceInput) {
  return { code: input.code, name: input.name, type: input.type, active: input.active };
}

/** Filtros compartilhados entre a listagem paginada e o export (CSV) do
 * histórico — os dois aceitam os mesmos parâmetros, só o export não pagina. */
function historyFilterParams(filter: HistoryFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.therapistId) params.set("therapist_id", filter.therapistId);
  if (filter.procedureId) params.set("procedure_id", filter.procedureId);
  if (filter.clientSearch) params.set("client_search", filter.clientSearch);
  if (filter.phase) params.set("phase", filter.phase);
  if (filter.dateFrom) params.set("date_from", filter.dateFrom);
  if (filter.dateTo) params.set("date_to", filter.dateTo);
  return params;
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

  bulkImportTherapists(
    rows: TherapistImportRowInput[],
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    return operationsRequest<ImportSummaryDto>(`${BASE}/therapists/bulk-import`, {
      method: "POST",
      body: JSON.stringify({
        dedupe_strategy: dedupeStrategy,
        rows: rows.map((r) => ({ code: r.code, name: r.name, active: r.active ?? true })),
      }),
    }).then(toImportSummary);
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

  bulkImportProcedures(
    rows: ProcedureImportRowInput[],
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    return operationsRequest<ImportSummaryDto>(`${BASE}/procedures/bulk-import`, {
      method: "POST",
      body: JSON.stringify({
        dedupe_strategy: dedupeStrategy,
        rows: rows.map((r) => ({
          code: r.code,
          name: r.name,
          points: r.points ?? 0,
          price_label: r.priceLabel ?? "",
          space_type: r.spaceType ?? "maca",
          space_minutes: r.spaceMinutes ?? 30,
          category: r.category ?? "",
          active: r.active ?? true,
        })),
      }),
    }).then(toImportSummary);
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

  listPointsByDay(isoDate: string): Promise<TherapistDailyPoints[]> {
    return operationsRequest<TherapistDailyPointsDto[]>(
      `${BASE}/points-by-day?on_date=${isoDate}`,
    ).then((items) => items.map(toTherapistDailyPoints));
  }

  getBusinessHours(): Promise<BusinessHoursEntry[]> {
    return operationsRequest<BusinessHoursEntryDto[]>(`${BASE}/business-hours`).then((items) =>
      items.map(toBusinessHoursEntry),
    );
  }

  updateBusinessHours(days: BusinessHoursEntry[]): Promise<BusinessHoursEntry[]> {
    return operationsRequest<BusinessHoursEntryDto[]>(`${BASE}/business-hours`, {
      method: "PUT",
      body: JSON.stringify({
        days: days.map((d) => ({
          weekday: d.weekday,
          closed: d.closed,
          opens_at: d.opensAt,
          closes_at: d.closesAt,
        })),
      }),
    }).then((items) => items.map(toBusinessHoursEntry));
  }

  getShiftHours(): Promise<ShiftHoursEntry[]> {
    return operationsRequest<ShiftHoursEntryDto[]>(`${BASE}/shift-hours`).then((items) =>
      items.map(toShiftHoursEntry),
    );
  }

  updateShiftHours(entries: ShiftHoursEntry[]): Promise<ShiftHoursEntry[]> {
    return operationsRequest<ShiftHoursEntryDto[]>(`${BASE}/shift-hours`, {
      method: "PUT",
      body: JSON.stringify({
        entries: entries.map((e) => ({
          weekday: e.weekday,
          shift: e.shift,
          opens_at: e.opensAt,
          closes_at: e.closesAt,
        })),
      }),
    }).then((items) => items.map(toShiftHoursEntry));
  }

  listSchedule(dateFrom: string, dateTo: string, therapistId?: string): Promise<ScheduleEntry[]> {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    if (therapistId) params.set("therapist_id", therapistId);
    return operationsRequest<ScheduleEntryDto[]>(`${BASE}/schedule?${params.toString()}`).then(
      (items) => items.map(toScheduleEntry),
    );
  }

  createScheduleEntry(input: CreateScheduleEntryInput): Promise<ScheduleEntry> {
    return operationsRequest<ScheduleEntryDto>(`${BASE}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        therapist_id: input.therapistId,
        date: input.date,
        shift: input.shift,
      }),
    }).then(toScheduleEntry);
  }

  deleteScheduleEntry(id: string): Promise<void> {
    return operationsRequest<void>(`${BASE}/schedule/${id}`, { method: "DELETE" });
  }

  /** Sem `dedupeStrategy`: uma linha de escala repetida (mesmo terapeuta/
   * dia/turno) não tem campo nenhum pra atualizar, só é ignorada. */
  bulkImportSchedule(rows: ScheduleImportRowInput[]): Promise<ImportSummary> {
    return operationsRequest<ImportSummaryDto>(`${BASE}/schedule/bulk-import`, {
      method: "POST",
      body: JSON.stringify({
        rows: rows.map((r) => ({ therapist_code: r.therapistCode, date: r.date, shift: r.shift })),
      }),
    }).then(toImportSummary);
  }

  async listHistory(filter: HistoryFilter): Promise<HistoryPage> {
    const params = historyFilterParams(filter);
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 20));
    const dto = await operationsRequest<HistoryPageDto>(`${BASE}/attendances?${params.toString()}`);
    return toHistoryPage(dto);
  }

  /** Correção pontual de pontos de um atendimento já finalizado, direto no
   * Histórico — pontos não são mais um contador à parte no terapeuta, o
   * saldo do dia reflete a mudança sozinho. */
  async updateAttendancePoints(id: string, pointsAwarded: number): Promise<AttendanceRecord> {
    const dto = await operationsRequest<AttendanceDto>(`${BASE}/attendances/${id}/points`, {
      method: "PATCH",
      body: JSON.stringify({ points_awarded: pointsAwarded }),
    });
    return toAttendance(dto);
  }

  async updateAttendancePayments(
    id: string,
    payments: PaymentAllocationInput[],
  ): Promise<AttendanceRecord> {
    const dto = await operationsRequest<AttendanceDto>(`${BASE}/attendances/${id}/payments`, {
      method: "PATCH",
      body: JSON.stringify({ payments: payments.map((p) => ({ method: p.method, amount: p.amount })) }),
    });
    return toAttendance(dto);
  }

  exportHistory(filter: HistoryFilter): Promise<string> {
    const params = historyFilterParams(filter);
    return operationsRequestText(`${BASE}/attendances/export?${params.toString()}`);
  }
}

export const operationsApiRepository = new OperationsApiRepository();
