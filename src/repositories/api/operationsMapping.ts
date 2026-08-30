/**
 * DTOs (snake_case, como o backend devolve) e conversores pra camelCase —
 * compartilhado entre `OperationsApiRepository` (CRUD autenticado) e
 * `TerapeutaDaVezPublicRepository` (painel aberto), porque os dois falam
 * com o mesmo módulo `operations` do backend e devolvem os mesmos formatos
 * de terapeuta/procedimento/atendimento.
 */
import type {
  AbsentTherapist,
  AttendanceAction,
  AttendanceRecord,
  BusinessHoursEntry,
  HistoryPage,
  ImportRowResult,
  ImportSummary,
  OperationsClient,
  PanelAlert,
  PanelState,
  Procedure,
  ProcedureOption,
  QueueEntry,
  ScheduleEntry,
  Shift,
  ShiftHoursEntry,
  SpaceAdmin,
  SpacePanelView,
  SpaceRequirement,
  Therapist,
  TherapistAction,
  TherapistDailyPoints,
  TherapistPoints,
  WaitlistAction,
  WaitlistEntry,
} from "../../types/operations";

export interface TherapistDto {
  id: string;
  code: string;
  name: string;
  active: boolean;
  status: string;
  present: boolean;
  current_shift: string | null;
  current_shift_label: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  points_manha_today: number;
  points_noturno_today: number;
  created_at: string;
  updated_at: string;
}

export interface TherapistPointsDto {
  date: string;
  points_manha: number;
  points_noturno: number;
}

export interface AbsentTherapistDto {
  id: string;
  code: string;
  name: string;
  available_shifts: string[];
}

export interface ScheduleEntryDto {
  id: string;
  therapist_id: string;
  therapist_name: string;
  date: string;
  shift: string;
  shift_label: string;
}

export interface TherapistDailyPointsDto {
  therapist_id: string;
  code: string;
  name: string;
  points_manha: number;
  points_noturno: number;
  points_total: number;
}

export interface BusinessHoursEntryDto {
  weekday: number;
  weekday_label: string;
  closed: boolean;
  opens_at: number | null;
  closes_at: number | null;
  label: string;
}

export interface ShiftHoursEntryDto {
  weekday: number;
  weekday_label: string;
  shift: string;
  shift_label: string;
  opens_at: number;
  closes_at: number;
  label: string;
}

export interface SpaceRequirementDto {
  type: string;
  minutes: number;
  label: string;
}

export interface ProcedureDto {
  id: string;
  code: string;
  name: string;
  duration_minutes: number;
  duration_label: string;
  points: number;
  price_label: string;
  space_requirements: SpaceRequirementDto[];
  type_label: string;
  category: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpaceAdminDto {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
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
  real_points: number;
  shift: string;
  shift_label: string;
  shift_range: string;
  status: string;
  position: number;
  bar_pct: number;
  attendance_id: string | null;
  client_name: string | null;
  client_phone: string | null;
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
  occupies_at: string | null;
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
  space_requirements: SpaceRequirementDto[];
  type_label: string;
  category: string;
}

export interface HistoryEntryDto {
  label: string;
  points: string;
}

export interface WaitlistEntryDto {
  id: string;
  client_name: string;
  client_phone: string;
  therapist_id: string;
  therapist_name: string;
  procedure_name: string;
  created_at: string;
  ready: boolean;
  conflict: boolean;
  available_at: string | null;
}

export interface PanelStateDto {
  server_time: string;
  points_min: number;
  points_max: number;
  queue: QueueEntryDto[];
  absent: AbsentTherapistDto[];
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
  store_open: boolean;
  next_open_at: string | null;
  waitlist: WaitlistEntryDto[];
}

export interface AttendanceDto {
  id: string;
  client_name: string | null;
  client_phone: string | null;
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

export interface TherapistActionDto {
  therapist: TherapistDto;
  state: PanelStateDto;
}

export interface WaitlistActionDto {
  entry: WaitlistEntryDto;
  state: PanelStateDto;
}

export interface HistoryPageDto {
  items: AttendanceDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface ImportRowResultDto {
  row_index: number;
  outcome: string;
  name: string;
  detail: string | null;
}

export interface ImportSummaryDto {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResultDto[];
}

export function toImportSummary(dto: ImportSummaryDto): ImportSummary {
  return {
    total: dto.total,
    created: dto.created,
    updated: dto.updated,
    skipped: dto.skipped,
    errors: dto.errors,
    rows: dto.rows.map((r) => ({
      rowIndex: r.row_index,
      outcome: r.outcome as ImportRowResult["outcome"],
      name: r.name,
      detail: r.detail,
    })),
  };
}

export function toTherapist(dto: TherapistDto): Therapist {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    active: dto.active,
    status: dto.status as Therapist["status"],
    present: dto.present,
    currentShift: dto.current_shift as Therapist["currentShift"],
    currentShiftLabel: dto.current_shift_label,
    checkedInAt: dto.checked_in_at,
    checkedOutAt: dto.checked_out_at,
    pointsManhaToday: dto.points_manha_today,
    pointsNoturnoToday: dto.points_noturno_today,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toTherapistPoints(dto: TherapistPointsDto): TherapistPoints {
  return { date: dto.date, pointsManha: dto.points_manha, pointsNoturno: dto.points_noturno };
}

function toAbsentTherapist(dto: AbsentTherapistDto): AbsentTherapist {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    availableShifts: dto.available_shifts as AbsentTherapist["availableShifts"],
  };
}

export function toScheduleEntry(dto: ScheduleEntryDto): ScheduleEntry {
  return {
    id: dto.id,
    therapistId: dto.therapist_id,
    therapistName: dto.therapist_name,
    date: dto.date,
    shift: dto.shift as ScheduleEntry["shift"],
    shiftLabel: dto.shift_label,
  };
}

export function toTherapistDailyPoints(dto: TherapistDailyPointsDto): TherapistDailyPoints {
  return {
    therapistId: dto.therapist_id,
    code: dto.code,
    name: dto.name,
    pointsManha: dto.points_manha,
    pointsNoturno: dto.points_noturno,
    pointsTotal: dto.points_total,
  };
}

export function toBusinessHoursEntry(dto: BusinessHoursEntryDto): BusinessHoursEntry {
  return {
    weekday: dto.weekday,
    weekdayLabel: dto.weekday_label,
    closed: dto.closed,
    opensAt: dto.opens_at,
    closesAt: dto.closes_at,
    label: dto.label,
  };
}

export function toShiftHoursEntry(dto: ShiftHoursEntryDto): ShiftHoursEntry {
  return {
    weekday: dto.weekday,
    weekdayLabel: dto.weekday_label,
    shift: dto.shift as Shift,
    shiftLabel: dto.shift_label,
    opensAt: dto.opens_at,
    closesAt: dto.closes_at,
    label: dto.label,
  };
}

function toSpaceRequirement(dto: SpaceRequirementDto): SpaceRequirement {
  return { type: dto.type as SpaceRequirement["type"], minutes: dto.minutes, label: dto.label };
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
    spaceRequirements: dto.space_requirements.map(toSpaceRequirement),
    typeLabel: dto.type_label,
    category: dto.category,
    active: dto.active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toSpaceAdmin(dto: SpaceAdminDto): SpaceAdmin {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    type: dto.type as SpaceAdmin["type"],
    active: dto.active,
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
    realPoints: dto.real_points,
    shift: dto.shift as QueueEntry["shift"],
    shiftLabel: dto.shift_label,
    shiftRange: dto.shift_range,
    status: dto.status as QueueEntry["status"],
    position: dto.position,
    barPct: dto.bar_pct,
    attendanceId: dto.attendance_id,
    clientName: dto.client_name,
    clientPhone: dto.client_phone,
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
    occupiesAt: dto.occupies_at,
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
    spaceRequirements: dto.space_requirements.map(toSpaceRequirement),
    typeLabel: dto.type_label,
    category: dto.category,
  };
}

export function toWaitlistEntry(dto: WaitlistEntryDto): WaitlistEntry {
  return {
    id: dto.id,
    clientName: dto.client_name,
    clientPhone: dto.client_phone,
    therapistId: dto.therapist_id,
    therapistName: dto.therapist_name,
    procedureName: dto.procedure_name,
    createdAt: dto.created_at,
    ready: dto.ready,
    conflict: dto.conflict,
    availableAt: dto.available_at,
  };
}

export function toWaitlistAction(dto: WaitlistActionDto): WaitlistAction {
  return { entry: toWaitlistEntry(dto.entry), state: toPanelState(dto.state) };
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
    absent: dto.absent.map(toAbsentTherapist),
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
    storeOpen: dto.store_open,
    nextOpenAt: dto.next_open_at,
    waitlist: dto.waitlist.map(toWaitlistEntry),
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

export function toTherapistAction(dto: TherapistActionDto): TherapistAction {
  return { therapist: toTherapist(dto.therapist), state: toPanelState(dto.state) };
}

export function toHistoryPage(dto: HistoryPageDto): HistoryPage {
  return {
    items: dto.items.map(toAttendance),
    total: dto.total,
    page: dto.page,
    pageSize: dto.page_size,
  };
}
