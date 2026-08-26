/**
 * DTOs (snake_case, como o backend devolve) e conversores pra camelCase —
 * compartilhado entre `OperationsApiRepository` (CRUD autenticado) e
 * `TerapeutaDaVezPublicRepository` (painel aberto), porque os dois falam
 * com o mesmo módulo `operations` do backend e devolvem os mesmos formatos
 * de terapeuta/procedimento/atendimento.
 */
import type {
  AttendanceAction,
  AttendanceRecord,
  HistoryPage,
  OperationsClient,
  PanelAlert,
  PanelState,
  Procedure,
  ProcedureOption,
  QueueEntry,
  SpacePanelView,
  Therapist,
} from "../../types/operations";

export interface TherapistDto {
  id: string;
  code: string;
  name: string;
  shift: string;
  shift_label: string;
  points: number;
  active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProcedureDto {
  id: string;
  code: string;
  name: string;
  duration_minutes: number;
  duration_label: string;
  points: number;
  price_label: string;
  space_types: string[];
  type_label: string;
  category: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientDto {
  id: string;
  name: string;
  phone: string;
  procedure_counts: Record<string, number>;
  total_services: number;
  last_service_at: string | null;
  created_at: string;
}

export interface QueueEntryDto {
  therapist_id: string;
  code: string;
  name: string;
  points: number;
  shift: string;
  shift_label: string;
  shift_range: string;
  in_shift: boolean;
  status: string;
  position: number | null;
  bar_pct: number;
  attendance_id: string | null;
  client_name: string | null;
  procedure_name: string | null;
  space_names: string[];
  called_at: string | null;
  start_at: string | null;
  planned_end_at: string | null;
}

export interface SpaceDto {
  id: string;
  code: string;
  name: string;
  type: string;
  state: string;
  therapist_name: string | null;
  client_name: string | null;
  procedure_name: string | null;
  available_at: string | null;
}

export interface AlertDto {
  kind: string;
  text: string;
  dot: string;
}

export interface ProcedureOptionDto {
  id: string;
  code: string;
  name: string;
  duration_minutes: number;
  duration_label: string;
  points: number;
  price_label: string;
  space_types: string[];
  type_label: string;
  category: string;
}

export interface HistoryEntryDto {
  label: string;
  points: string;
}

export interface PanelStateDto {
  server_time: string;
  points_min: number;
  points_max: number;
  queue: QueueEntryDto[];
  spaces: SpaceDto[];
  alerts: AlertDto[];
  services_today: number;
  points_today: number;
  spaces_free: number;
  spaces_total: number;
  last_entry: HistoryEntryDto | null;
  recent_history: HistoryEntryDto[];
  procedure_groups: Record<string, ProcedureOptionDto[]>;
  client_suggestions: string[];
}

export interface AttendanceDto {
  id: string;
  client_name: string;
  client_phone: string;
  therapist_name: string;
  procedure_name: string | null;
  space_names: string[];
  phase: string;
  points_awarded: number | null;
  called_at: string;
  start_at: string | null;
  planned_end_at: string | null;
  finished_at: string | null;
}

export interface AttendanceActionDto {
  attendance: AttendanceDto;
  state: PanelStateDto;
}

export interface HistoryPageDto {
  items: AttendanceDto[];
  total: number;
  page: number;
  page_size: number;
}

export function toTherapist(dto: TherapistDto): Therapist {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    shift: dto.shift as Therapist["shift"],
    shiftLabel: dto.shift_label,
    points: dto.points,
    active: dto.active,
    status: dto.status as Therapist["status"],
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toProcedure(dto: ProcedureDto): Procedure {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    durationMinutes: dto.duration_minutes,
    durationLabel: dto.duration_label,
    points: dto.points,
    priceLabel: dto.price_label,
    spaceTypes: dto.space_types as Procedure["spaceTypes"],
    typeLabel: dto.type_label,
    category: dto.category,
    active: dto.active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toClient(dto: ClientDto): OperationsClient {
  return {
    id: dto.id,
    name: dto.name,
    phone: dto.phone,
    procedureCounts: dto.procedure_counts,
    totalServices: dto.total_services,
    lastServiceAt: dto.last_service_at,
    createdAt: dto.created_at,
  };
}

function toQueueEntry(dto: QueueEntryDto): QueueEntry {
  return {
    therapistId: dto.therapist_id,
    code: dto.code,
    name: dto.name,
    points: dto.points,
    shift: dto.shift as QueueEntry["shift"],
    shiftLabel: dto.shift_label,
    shiftRange: dto.shift_range,
    inShift: dto.in_shift,
    status: dto.status as QueueEntry["status"],
    position: dto.position,
    barPct: dto.bar_pct,
    attendanceId: dto.attendance_id,
    clientName: dto.client_name,
    procedureName: dto.procedure_name,
    spaceNames: dto.space_names,
    calledAt: dto.called_at,
    startAt: dto.start_at,
    plannedEndAt: dto.planned_end_at,
  };
}

function toSpace(dto: SpaceDto): SpacePanelView {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    type: dto.type as SpacePanelView["type"],
    state: dto.state as SpacePanelView["state"],
    therapistName: dto.therapist_name,
    clientName: dto.client_name,
    procedureName: dto.procedure_name,
    availableAt: dto.available_at,
  };
}

function toAlert(dto: AlertDto): PanelAlert {
  return { kind: dto.kind, text: dto.text, dot: dto.dot };
}

function toProcedureOption(dto: ProcedureOptionDto): ProcedureOption {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    durationMinutes: dto.duration_minutes,
    durationLabel: dto.duration_label,
    points: dto.points,
    priceLabel: dto.price_label,
    spaceTypes: dto.space_types as ProcedureOption["spaceTypes"],
    typeLabel: dto.type_label,
    category: dto.category,
  };
}

export function toPanelState(dto: PanelStateDto): PanelState {
  const groups: Record<string, ProcedureOption[]> = {};
  for (const [category, items] of Object.entries(dto.procedure_groups)) {
    groups[category] = items.map(toProcedureOption);
  }
  return {
    serverTime: dto.server_time,
    pointsMin: dto.points_min,
    pointsMax: dto.points_max,
    queue: dto.queue.map(toQueueEntry),
    spaces: dto.spaces.map(toSpace),
    alerts: dto.alerts.map(toAlert),
    servicesToday: dto.services_today,
    pointsToday: dto.points_today,
    spacesFree: dto.spaces_free,
    spacesTotal: dto.spaces_total,
    lastEntry: dto.last_entry,
    recentHistory: dto.recent_history,
    procedureGroups: groups,
    clientSuggestions: dto.client_suggestions,
  };
}

export function toAttendance(dto: AttendanceDto): AttendanceRecord {
  return {
    id: dto.id,
    clientName: dto.client_name,
    clientPhone: dto.client_phone,
    therapistName: dto.therapist_name,
    procedureName: dto.procedure_name,
    spaceNames: dto.space_names,
    phase: dto.phase as AttendanceRecord["phase"],
    pointsAwarded: dto.points_awarded,
    calledAt: dto.called_at,
    startAt: dto.start_at,
    plannedEndAt: dto.planned_end_at,
    finishedAt: dto.finished_at,
  };
}

export function toAttendanceAction(dto: AttendanceActionDto): AttendanceAction {
  return { attendance: toAttendance(dto.attendance), state: toPanelState(dto.state) };
}

export function toHistoryPage(dto: HistoryPageDto): HistoryPage {
  return { items: dto.items.map(toAttendance), total: dto.total, page: dto.page, pageSize: dto.page_size };
}
