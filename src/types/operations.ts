export type Shift = "manha" | "inter" | "noturno";
export type SpaceType = "maca" | "cadeira" | "poltrona";
// "ausente" = sem Entrada hoje (ou turno já encerrado sem Saída).
export type TherapistStatus = "ausente" | "idle" | "reception" | "therapy";
export type QueueStatus = "idle" | "reception" | "therapy";
export type SpaceState = "free" | "occupied" | "cleaning";
export type AttendancePhase = "reception" | "therapy" | "finished" | "declined";

/** Sem turno/pontos fixos: turno é escolhido a cada Entrada e pontos são
 * sempre derivados do histórico de hoje (`pointsManhaToday`/`pointsNoturnoToday`). */
export interface Therapist {
  id: string;
  code: string;
  name: string;
  active: boolean;
  status: TherapistStatus;
  present: boolean;
  currentShift: Shift | null;
  currentShiftLabel: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  pointsManhaToday: number;
  pointsNoturnoToday: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTherapistInput {
  code: string;
  name: string;
  active?: boolean;
}

export type UpdateTherapistInput = Partial<CreateTherapistInput>;

export interface TherapistPoints {
  date: string;
  pointsManha: number;
  pointsNoturno: number;
}

export interface AbsentTherapist {
  id: string;
  code: string;
  name: string;
  availableShifts: Shift[];
}

export interface TherapistAction {
  therapist: Therapist;
  state: PanelState;
}

/** Um "trecho" do procedimento num tipo de espaço — ex.: 30 min numa maca
 * seguidos de 15 min numa poltrona. A ordem importa: é a ordem de uso. */
export interface SpaceRequirement {
  type: SpaceType;
  minutes: number;
  label: string;
}

export interface SpaceRequirementInput {
  type: SpaceType;
  minutes: number;
}

export interface Procedure {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  durationLabel: string;
  points: number;
  priceLabel: string;
  spaceRequirements: SpaceRequirement[];
  typeLabel: string;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcedureInput {
  code: string;
  name: string;
  points: number;
  priceLabel?: string;
  spaceRequirements: SpaceRequirementInput[];
  category?: string;
  active?: boolean;
}

export type UpdateProcedureInput = Partial<CreateProcedureInput>;

export interface SpaceAdmin {
  id: string;
  code: string;
  name: string;
  type: SpaceType;
  active: boolean;
}

export interface CreateSpaceInput {
  code: string;
  name: string;
  type: SpaceType;
  active?: boolean;
}

export type UpdateSpaceInput = Partial<CreateSpaceInput>;

export interface OperationsClient {
  id: string;
  name: string;
  phone: string;
  procedureCounts: Record<string, number>;
  totalServices: number;
  lastServiceAt: string | null;
  createdAt: string;
}

export interface QueueEntry {
  therapistId: string;
  code: string;
  name: string;
  points: number;
  realPoints: number;
  shift: Shift;
  shiftLabel: string;
  shiftRange: string;
  status: QueueStatus;
  position: number;
  barPct: number;
  attendanceId: string | null;
  clientName: string | null;
  procedureName: string | null;
  spaceNames: string[];
  calledAt: string | null;
  startAt: string | null;
  plannedEndAt: string | null;
}

export interface SpacePanelView {
  id: string;
  code: string;
  name: string;
  type: SpaceType;
  state: SpaceState;
  therapistName: string | null;
  clientName: string | null;
  procedureName: string | null;
  availableAt: string | null;
}

export interface PanelAlert {
  kind: string;
  text: string;
  dot: string;
}

export interface ProcedureOption {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  durationLabel: string;
  points: number;
  priceLabel: string;
  spaceRequirements: SpaceRequirement[];
  typeLabel: string;
  category: string;
}

export interface HistoryEntrySummary {
  label: string;
  points: string;
}

export interface PanelState {
  serverTime: string;
  pointsMin: number;
  pointsMax: number;
  queue: QueueEntry[];
  absent: AbsentTherapist[];
  spaces: SpacePanelView[];
  alerts: PanelAlert[];
  servicesToday: number;
  pointsToday: number;
  spacesFree: number;
  spacesTotal: number;
  lastEntry: HistoryEntrySummary | null;
  recentHistory: HistoryEntrySummary[];
  procedureGroups: Record<string, ProcedureOption[]>;
  clientSuggestions: string[];
}

export interface AttendanceRecord {
  id: string;
  clientName: string;
  clientPhone: string;
  therapistName: string;
  procedureName: string | null;
  spaceNames: string[];
  phase: AttendancePhase;
  pointsAwarded: number | null;
  calledAt: string;
  startAt: string | null;
  plannedEndAt: string | null;
  finishedAt: string | null;
}

export interface AttendanceAction {
  attendance: AttendanceRecord;
  state: PanelState;
}

export interface HistoryFilter {
  therapistId?: string | undefined;
  procedureId?: string | undefined;
  clientSearch?: string | undefined;
  phase?: AttendancePhase | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number;
  pageSize?: number;
}

export interface HistoryPage {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
}
