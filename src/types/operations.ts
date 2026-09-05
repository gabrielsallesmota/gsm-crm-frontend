export type Shift = "manha" | "inter" | "noturno";
export type SpaceType = "maca" | "cadeira" | "poltrona";
// "ausente" = ainda não iniciou o turno hoje (ou o turno escalado já
// passou da janela de horário). Não existe mais Saída manual — questão
// trabalhista (terapeutas são PJ): a presença termina sozinha quando a
// janela do turno passa.
// "pausa" = pausa manual (recepção clica Pausar/Retomar — ex.: foi
// almoçar). Sem limite de tempo, nunca vira histórico/jornada — some do
// "quem pode ser chamado" enquanto durar, mas continua presente/no turno.
export type TherapistStatus = "ausente" | "idle" | "pausa" | "reception" | "therapy";
export type QueueStatus = "idle" | "pausa" | "reception" | "therapy";
export type SpaceState = "free" | "occupied" | "cleaning";
export type AttendancePhase = "reception" | "therapy" | "finished" | "declined";

/** Controle OPERACIONAL da recepção pra bater com o ERP Graces depois —
 * não é um conceito fiscal/contábil. Lista e ordem de exibição definidas
 * pelo usuário (bate com os códigos curtos do Graces, entre parênteses no
 * rótulo). */
export type PaymentMethod =
  | "credito"
  | "debito"
  | "dinheiro"
  | "pix"
  | "conta_corrente"
  | "vale_presente"
  | "resgate"
  | "cortesia"
  | "convenio"
  | "voucher";

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "credito", label: "Cartão de Crédito (CR)" },
  { value: "debito", label: "Cartão de Débito (DB)" },
  { value: "dinheiro", label: "Dinheiro (R$)" },
  { value: "pix", label: "PIX" },
  { value: "conta_corrente", label: "Conta Corrente (CC)" },
  { value: "vale_presente", label: "Vale Presente (VP)" },
  { value: "resgate", label: "Resgate (RESG)" },
  { value: "cortesia", label: "Cortesia (CT)" },
  { value: "convenio", label: "Convênio (CV)" },
  { value: "voucher", label: "Voucher" },
];

export interface PaymentAllocation {
  method: PaymentMethod;
  methodLabel: string;
  amount: number;
}

export interface PaymentAllocationInput {
  method: PaymentMethod;
  amount: number;
}

export interface PaymentSummaryEntry {
  method: PaymentMethod;
  methodLabel: string;
  total: number;
}

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
  onBreakAt: string | null;
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

/** Escala: "fulano trabalha o turno X no dia D" — cadastrada por dia
 * específico nas configs, nunca um padrão semanal fixo. Substitui
 * Entrada/Saída livre (terapeutas são PJ — ver TherapistStatus). O painel
 * só oferece "Iniciar turno" pros turnos escalados de hoje que já estão
 * na janela de horário (`AbsentTherapist.availableShifts`, calculado pelo
 * backend). */
export interface ScheduleEntry {
  id: string;
  therapistId: string;
  therapistName: string;
  date: string;
  shift: Shift;
  shiftLabel: string;
  /** Horário excepcional só dessa linha (minutos desde meia-noite) — estreita
   * a janela padrão do turno, nunca alarga. `null`/`null` = janela padrão. */
  customOpensAt: number | null;
  customClosesAt: number | null;
  /** Rótulo pronto pra exibir, ex. "16:00–18:00", ou `null` sem exceção. */
  customHoursLabel: string | null;
  /** `true` quando essa linha já foi trocada de terapeuta ao menos uma vez
   * (o `id` é preservado — troca é sempre UPDATE, nunca apaga+recria). */
  isSubstitution: boolean;
  substitutedTherapistName: string | null;
}

export interface CreateScheduleEntryInput {
  therapistId: string;
  date: string;
  shift: Shift;
}

export interface UpdateScheduleEntryHoursInput {
  opensAt: number | null;
  closesAt: number | null;
}

export interface SubstituteScheduleEntryTherapistInput {
  newTherapistId: string;
  reason?: string;
}

export interface TherapistDailyPoints {
  therapistId: string;
  code: string;
  name: string;
  pointsManha: number;
  pointsNoturno: number;
  pointsTotal: number;
}

export interface BusinessHoursEntry {
  weekday: number;
  weekdayLabel: string;
  closed: boolean;
  opensAt: number | null;
  closesAt: number | null;
  label: string;
}

/** Janela de UM turno (Manhã/Interturno/Noturno) NUM dia da semana —
 * diferente de `BusinessHoursEntry` (horário de funcionamento da loja):
 * isto é a janela do turno em si, que também pode variar por dia ("domingo
 * pode ser que manhã, interjornada e tarde sejam diferentes"). 21 linhas
 * fixas (7 dias × 3 turnos), editadas juntas na gestão. */
export interface ShiftHoursEntry {
  weekday: number;
  weekdayLabel: string;
  shift: Shift;
  shiftLabel: string;
  opensAt: number;
  closesAt: number;
  label: string;
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
  /** Valor numérico de verdade — `priceLabel` continua sendo só texto de
   * exibição. Usado pra validar a soma das formas de pagamento. */
  price: number;
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
  price?: number;
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
  clientPhone: string | null;
  procedureName: string | null;
  spaceNames: string[];
  calledAt: string | null;
  startAt: string | null;
  plannedEndAt: string | null;
  /** Valor do procedimento escolhido — só existe a partir do "Iniciar
   * terapia" (snapshot do preço do procedimento). */
  price: number | null;
  /** `true` quando este terapeuta foi chamado fora da ordem da fila —
   * "decisão do paciente" (cliente escolheu, pulou quem estava na vez). */
  outOfOrder: boolean;
  /** Calculado ao vivo — atendimento com valor a cobrar e nenhuma forma de
   * pagamento registrada ainda (pagamento é pedido antes de iniciar, mas
   * continua opcional). */
  paymentPending: boolean;
  /** Próximo agendamento de HOJE (Agenda) pra este terapeuta — `null`
   * quando não tem nenhum. Mostrado embaixo da linha na fila, destacado
   * quando faltar menos de 1h (pedido do usuário). */
  nextAppointmentAt: string | null;
  nextAppointmentClientName: string | null;
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
  /** Só preenchido quando `state === "free"` mas um atendimento já em
   * andamento tem um trecho futuro reservado aqui (procedimento com mais
   * de um espaço, ex.: maca agora + esta poltrona daqui a pouco). */
  occupiesAt: string | null;
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
  price: number;
  spaceRequirements: SpaceRequirement[];
  typeLabel: string;
  category: string;
}

export interface HistoryEntrySummary {
  label: string;
  points: string;
}

/** Reserva de terapeuta específico — cliente quer um terapeuta que está
 * livre, mas o ESPAÇO que o procedimento precisa não está. `ready`/
 * `conflict`/`availableAt` são recalculados a cada leitura do painel, nunca
 * travam chamar/iniciar outro cliente nesse meio tempo (só avisam). */
export interface WaitlistEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  therapistId: string;
  therapistName: string;
  procedureName: string;
  createdAt: string;
  ready: boolean;
  conflict: boolean;
  availableAt: string | null;
}

export interface CreateWaitlistEntryInput {
  therapistId: string;
  clientName: string;
  phone: string;
  procedureId: string;
  /** Atendimento em recepção que originou a reserva (ex.: terapeuta já
   * chamado, mas nenhum espaço livre no passo de escolher espaço) — se
   * vier preenchido, o backend recusa esse atendimento junto, liberando o
   * terapeuta pra fila normal de novo. */
  attendanceId?: string;
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
  storeOpen: boolean;
  nextOpenAt: string | null;
  waitlist: WaitlistEntry[];
  /** Resumo "valores registrados" do dia, por forma de pagamento — só
   * conferência operacional com o Graces, não é faturamento contábil. */
  paymentsToday: PaymentSummaryEntry[];
  /** "Volta mais tarde" — ver `ReturnReservation`. Mostrada no painel
   * principal (não só na Agenda), com contagem regressiva ao vivo. */
  returnReservations: ReturnReservation[];
}

export interface AttendanceRecord {
  id: string;
  /** `null` até o passo de escolher espaço — a chamada não pede mais
   * nome/telefone do cliente (`clientPhone` nunca mais é preenchido: o
   * telefone só existe na fila de espera, que continua tendo o próprio
   * cadastro). */
  clientName: string | null;
  clientPhone: string | null;
  therapistName: string;
  procedureName: string | null;
  spaceNames: string[];
  phase: AttendancePhase;
  pointsAwarded: number | null;
  calledAt: string;
  startAt: string | null;
  plannedEndAt: string | null;
  finishedAt: string | null;
  price: number | null;
  payments: PaymentAllocation[];
  /** Finalizado, com valor a cobrar, mas sem forma de pagamento registrada
   * ainda (a recepção terminou sem informar na hora) — sempre derivado do
   * backend, nunca um campo que se digita. */
  paymentPending: boolean;
}

export interface AttendanceAction {
  attendance: AttendanceRecord;
  state: PanelState;
}

export interface WaitlistAction {
  entry: WaitlistEntry;
  state: PanelState;
}

// ---- Agenda do dia + "volta mais tarde" -------------------------------------
// Grade estilo Google Agenda (colunas = espaços, linhas = horário) — não deixa
// marcar em cima de outro horário, igual já vale pro cliente que chega sem
// hora marcada (o backend cruza os dois: ver `find_conflicting_appointment`/
// `find_conflicting_space`). "Volta mais tarde" é uma reserva RÁPIDA (sem
// espaço/terapeuta) só pra procedimento curto — o resto é direcionado pra
// Agenda de verdade, pré-preenchida.

export type AppointmentStatus = "scheduled" | "completed" | "no_show" | "cancelled";

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  spaceId: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  statusLabel: string;
  /** `null` = sem preferência, a recepção resolve na hora (ver `preferenceNote`). */
  therapistId: string | null;
  therapistName: string | null;
  procedureId: string | null;
  procedureName: string | null;
  preferenceNote: string | null;
  /** Liga os trechos de um procedimento "casado" (2+ espaços em sequência,
   * ex.: Maca 30min + Poltrona 15min) — cada trecho é um `Appointment`
   * próprio, todos com o mesmo `groupId` (gerado no frontend na hora de
   * criar). `null` = trecho único (a maioria). Usado só pra "editar/
   * excluir o conjunto" na Agenda. */
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  clientName: string;
  phone: string;
  spaceId: string;
  startAt: string;
  endAt: string;
  therapistId?: string;
  procedureId?: string;
  preferenceNote?: string;
  /** Ver docstring de `Appointment.groupId`. */
  groupId?: string;
}

/** `undefined` em cada campo quer dizer "não mexe" — mesma convenção do
 * resto do módulo. `clearTherapist: true` existe à parte porque "sem
 * terapeuta definido" é um estado de verdade que só omitir `therapistId`
 * não consegue expressar. */
export interface UpdateAppointmentInput {
  clientName?: string;
  phone?: string;
  spaceId?: string;
  startAt?: string;
  endAt?: string;
  therapistId?: string;
  clearTherapist?: boolean;
  procedureId?: string;
  preferenceNote?: string;
  status?: AppointmentStatus;
}

export interface AppointmentsForDay {
  appointments: Appointment[];
  total: number;
  noShowCount: number;
}

/** Ver docstring de `PanelState.returnReservations`. */
export interface ReturnReservation {
  id: string;
  clientName: string;
  clientPhone: string;
  procedureId: string;
  procedureName: string;
  returnAt: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateReturnReservationInput {
  clientName: string;
  phone: string;
  procedureId: string;
  minutes: number;
}

export interface ReturnReservationAction {
  reservation: ReturnReservation;
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

// ---- Import em massa (CSV) — de/para feito no frontend, mesmo padrão de
// leads/prospects. Sem "duplicate": código é único no banco. ------------

export type DedupeStrategy = "skip" | "update";

export interface ImportRowResult {
  rowIndex: number;
  outcome: "created" | "updated" | "skipped" | "error";
  name: string;
  detail: string | null;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
}

export interface TherapistImportRowInput {
  code: string;
  name: string;
  active?: boolean;
}

export const IMPORTABLE_THERAPIST_FIELDS: { key: keyof TherapistImportRowInput; label: string }[] = [
  { key: "code", label: "Código" },
  { key: "name", label: "Nome" },
  { key: "active", label: "Ativo" },
];

export interface ProcedureImportRowInput {
  code: string;
  name: string;
  points?: number;
  priceLabel?: string;
  price?: number;
  spaceType?: SpaceType;
  spaceMinutes?: number;
  category?: string;
  active?: boolean;
}

export const IMPORTABLE_PROCEDURE_FIELDS: { key: keyof ProcedureImportRowInput; label: string }[] = [
  { key: "code", label: "Código" },
  { key: "name", label: "Nome" },
  { key: "points", label: "Pontuação" },
  { key: "priceLabel", label: "Preço" },
  { key: "spaceType", label: "Tipo de espaço (maca/cadeira/poltrona)" },
  { key: "spaceMinutes", label: "Minutos do espaço" },
  { key: "category", label: "Categoria" },
  { key: "active", label: "Ativo" },
];

/** `therapistCode` (não `therapistId`) porque a planilha não tem UUID — o
 * backend resolve por código OU nome já cadastrado (a escala real da loja
 * só tem o primeiro nome de cada pessoa, sem código). `date` sempre ISO
 * (yyyy-mm-dd) na hora de enviar; o modal normaliza formatos comuns de
 * planilha (dd/mm/aaaa) antes disso. Sem "duplicate"/"update": uma linha
 * repetida (mesmo terapeuta/dia/turno) só é ignorada. */
export interface ScheduleImportRowInput {
  therapistCode: string;
  date: string;
  shift: Shift;
}

export const IMPORTABLE_SCHEDULE_FIELDS: { key: keyof ScheduleImportRowInput; label: string }[] = [
  { key: "therapistCode", label: "Código ou nome do terapeuta" },
  { key: "date", label: "Data" },
  { key: "shift", label: "Turno (manhã/intermediário/tarde-noturno)" },
];
