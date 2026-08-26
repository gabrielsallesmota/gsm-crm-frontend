export type Shift = "manha" | "inter" | "tarde";
export type SpaceType = "maca" | "cadeira" | "poltrona";
export type TherapistStatus = "idle" | "reception" | "therapy";
export type QueueStatus = TherapistStatus | "out_of_shift";
export type SpaceState = "free" | "occupied" | "cleaning";
export type AttendancePhase = "reception" | "therapy" | "finished" | "declined";

export interface Therapist {
  id: string;
  code: string;
  name: string;
  shift: Shift;
  shiftLabel: string;
  points: number;
  active: boolean;
  status: TherapistStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTherapistInput {
  code: string;
  name: string;
  shift: Shift;
  points?: number;
  active?: boolean;
}

export type UpdateTherapistInput = Partial<CreateTherapistInput>;

export interface Procedure {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  durationLabel: string;
  points: number;
  priceLabel: string;
  spaceTypes: SpaceType[];
  typeLabel: string;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcedureInput {
  code: string;
  name: string;
  durationMinutes: number;
  points: number;
  priceLabel?: string;
  spaceTypes: SpaceType[];
  category?: string;
  active?: boolean;
}

export type UpdateProcedureInput = Partial<CreateProcedureInput>;

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
  shift: Shift;
  shiftLabel: string;
  shiftRange: string;
  inShift: boolean;
  status: QueueStatus;
  position: number | null;
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
  spaceTypes: SpaceType[];
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
