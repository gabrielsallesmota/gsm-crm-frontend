import { ApiError } from "../../types/common";
import { BASE_URL } from "./ApiClient";
import {
  toAppointment,
  toAppointmentsForDay,
  toAttendance,
  toAttendanceAction,
  toHistoryPage,
  toPanelState,
  toReturnReservationAction,
  toScheduleEntry,
  toTherapistAction,
  toWaitlistAction,
  type AppointmentDto,
  type AppointmentsForDayDto,
  type AttendanceActionDto,
  type AttendanceDto,
  type HistoryPageDto,
  type PanelStateDto,
  type ReturnReservationActionDto,
  type ScheduleEntryDto,
  type TherapistActionDto,
  type WaitlistActionDto,
} from "./operationsMapping";
import type {
  Appointment,
  AppointmentsForDay,
  AttendanceAction,
  AttendanceRecord,
  CreateAppointmentInput,
  CreateReturnReservationInput,
  CreateScheduleEntryInput,
  CreateWaitlistEntryInput,
  HistoryFilter,
  HistoryPage,
  PanelState,
  PaymentAllocationInput,
  ReturnReservationAction,
  ScheduleEntry,
  Shift,
  SubstituteScheduleEntryTherapistInput,
  TherapistAction,
  UpdateAppointmentInput,
  UpdateScheduleEntryHoursInput,
  WaitlistAction,
} from "../../types/operations";

const BASE = "/api/v1/public/terapeuta-da-vez";

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

async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : "Erro ao comunicar com o servidor.";
  } catch {
    return "Erro ao comunicar com o servidor.";
  }
}

/**
 * Cliente HTTP próprio (não usa `apiRequest`) — o painel do quiosque é
 * aberto de propósito (pedido do cliente), sem token de sessão do CRM.
 */
async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!resp.ok) throw new ApiError(resp.status, await readErrorDetail(resp));
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

/** Variante que devolve texto cru (CSV de export), não JSON. */
async function publicRequestText(path: string): Promise<string> {
  const resp = await fetch(`${BASE_URL}${path}`);
  if (!resp.ok) throw new ApiError(resp.status, await readErrorDetail(resp));
  return resp.text();
}

export class TerapeutaDaVezPublicRepository {
  async getState(): Promise<PanelState> {
    const dto = await publicRequest<PanelStateDto>(`${BASE}/state`);
    return toPanelState(dto);
  }

  /** Sem nome/telefone do cliente — pedido do usuário: a chamada não pede
   * mais essa informação, o nome é digitado depois junto com o espaço
   * (ver `start`). */
  async call(therapistId: string): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/call`, {
      method: "POST",
      body: JSON.stringify({ therapist_id: therapistId }),
    });
    return toAttendanceAction(dto);
  }

  async decline(attendanceId: string): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/decline`, {
      method: "POST",
    });
    return toAttendanceAction(dto);
  }

  /** `clientName`/`phone` — pedidos junto com a escolha do procedimento/
   * espaço; a partir daqui sempre cadastram/reaproveitam um `Client`.
   * `payments` — pagamento é ANTES de iniciar (pedido do usuário), mas
   * continua opcional: vazio deixa "pagamento pendente" (ao vivo). */
  async start(
    attendanceId: string,
    procedureId: string,
    spaceIds: string[],
    clientName: string,
    phone: string,
    payments: PaymentAllocationInput[] = [],
  ): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/start`, {
      method: "POST",
      body: JSON.stringify({
        procedure_id: procedureId,
        space_ids: spaceIds,
        client_name: clientName,
        phone,
        payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      }),
    });
    return toAttendanceAction(dto);
  }

  async finish(
    attendanceId: string,
    awardPoints: boolean,
    payments: PaymentAllocationInput[] = [],
  ): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/finish`, {
      method: "POST",
      body: JSON.stringify({
        award_points: awardPoints,
        payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      }),
    });
    return toAttendanceAction(dto);
  }

  /** "Iniciar turno" — sem endpoint de Saída (questão trabalhista:
   * terapeutas são PJ). A presença termina sozinha quando a janela do
   * turno passa; não existe ação manual de encerrar. */
  async checkIn(therapistId: string, shift?: Shift): Promise<TherapistAction> {
    const dto = await publicRequest<TherapistActionDto>(
      `${BASE}/therapists/${therapistId}/check-in`,
      { method: "POST", body: JSON.stringify({ shift: shift ?? null }) },
    );
    return toTherapistAction(dto);
  }

  /** Pausa manual (ex.: foi almoçar) — sem limite de tempo, nunca vira
   * histórico/jornada. Bloqueado enquanto o terapeuta está em atendimento. */
  async pause(therapistId: string): Promise<TherapistAction> {
    const dto = await publicRequest<TherapistActionDto>(
      `${BASE}/therapists/${therapistId}/pause`,
      { method: "POST" },
    );
    return toTherapistAction(dto);
  }

  /** Volta da pausa. */
  async resume(therapistId: string): Promise<TherapistAction> {
    const dto = await publicRequest<TherapistActionDto>(
      `${BASE}/therapists/${therapistId}/resume`,
      { method: "POST" },
    );
    return toTherapistAction(dto);
  }

  /** Botão pequeno "Liberar" ao lado de um espaço em higienização — pula o
   * resto da espera quando a limpeza de verdade já terminou antes do
   * `CLEANING_MINUTES` padrão. */
  async releaseCleaning(spaceId: string): Promise<PanelState> {
    const dto = await publicRequest<PanelStateDto>(`${BASE}/spaces/${spaceId}/release-cleaning`, {
      method: "POST",
    });
    return toPanelState(dto);
  }

  /** "Colocar na fila de espera" — cliente quer um terapeuta específico,
   * que está livre mas o espaço que o procedimento precisa não está. */
  async createWaitlistEntry(input: CreateWaitlistEntryInput): Promise<WaitlistAction> {
    const dto = await publicRequest<WaitlistActionDto>(`${BASE}/waitlist`, {
      method: "POST",
      body: JSON.stringify({
        therapist_id: input.therapistId,
        client_name: input.clientName,
        phone: input.phone,
        procedure_id: input.procedureId,
        attendance_id: input.attendanceId ?? null,
      }),
    });
    return toWaitlistAction(dto);
  }

  async confirmWaitlistEntry(entryId: string): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/waitlist/${entryId}/confirm`, {
      method: "POST",
    });
    return toAttendanceAction(dto);
  }

  async cancelWaitlistEntry(entryId: string): Promise<PanelState> {
    const dto = await publicRequest<PanelStateDto>(`${BASE}/waitlist/${entryId}/cancel`, {
      method: "POST",
    });
    return toPanelState(dto);
  }

  /** Escala — editável direto do painel público (sem senha), mesma postura
   * do resto das ações do quiosque. `dateFrom`/`dateTo` inclusive. */
  async listSchedule(dateFrom: string, dateTo: string): Promise<ScheduleEntry[]> {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    const items = await publicRequest<ScheduleEntryDto[]>(`${BASE}/schedule?${params.toString()}`);
    return items.map(toScheduleEntry);
  }

  async createScheduleEntry(input: CreateScheduleEntryInput): Promise<ScheduleEntry> {
    const dto = await publicRequest<ScheduleEntryDto>(`${BASE}/schedule`, {
      method: "POST",
      body: JSON.stringify({ therapist_id: input.therapistId, date: input.date, shift: input.shift }),
    });
    return toScheduleEntry(dto);
  }

  async deleteScheduleEntry(entryId: string): Promise<void> {
    await publicRequest<void>(`${BASE}/schedule/${entryId}`, { method: "DELETE" });
  }

  /** Horário excepcional de uma linha — ambos `null` volta pro padrão do
   * turno (estreita só a janela de presença, nunca alarga). */
  async updateScheduleEntryHours(
    entryId: string,
    input: UpdateScheduleEntryHoursInput,
  ): Promise<ScheduleEntry> {
    const dto = await publicRequest<ScheduleEntryDto>(`${BASE}/schedule/${entryId}/hours`, {
      method: "PATCH",
      body: JSON.stringify({ opens_at: input.opensAt, closes_at: input.closesAt }),
    });
    return toScheduleEntry(dto);
  }

  /** Substituir quem está escalado — UPDATE na mesma linha (`id`
   * preservado), sempre gravado na trilha de auditoria. */
  async substituteScheduleEntryTherapist(
    entryId: string,
    input: SubstituteScheduleEntryTherapistInput,
  ): Promise<ScheduleEntry> {
    const dto = await publicRequest<ScheduleEntryDto>(`${BASE}/schedule/${entryId}/substitute`, {
      method: "POST",
      body: JSON.stringify({ new_therapist_id: input.newTherapistId, reason: input.reason ?? null }),
    });
    return toScheduleEntry(dto);
  }

  /** Histórico — também sem senha (consulta do dia direto do painel),
   * mesmos dados/filtros do histórico da gestão, SEM edição de pontos/
   * pagamentos (isso continua exclusivo de `/gestao`). */
  async listHistory(filter: HistoryFilter): Promise<HistoryPage> {
    const params = historyFilterParams(filter);
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 200));
    const dto = await publicRequest<HistoryPageDto>(`${BASE}/attendances?${params.toString()}`);
    return toHistoryPage(dto);
  }

  exportHistory(filter: HistoryFilter): Promise<string> {
    const params = historyFilterParams(filter);
    return publicRequestText(`${BASE}/attendances/export?${params.toString()}`);
  }

  /** Registrar (ou corrigir) a forma de pagamento de um atendimento já
   * finalizado — como a recepção resolve um "pagamento pendente" direto do
   * Histórico, sem senha. */
  async updateAttendancePayments(
    attendanceId: string,
    payments: PaymentAllocationInput[],
  ): Promise<AttendanceRecord> {
    const dto = await publicRequest<AttendanceDto>(`${BASE}/attendances/${attendanceId}/payments`, {
      method: "PATCH",
      body: JSON.stringify({ payments: payments.map((p) => ({ method: p.method, amount: p.amount })) }),
    });
    return toAttendance(dto);
  }

  /** Agenda do dia — grade estilo Google Agenda, sem senha (mesmo critério
   * de Escala/Histórico). `day` sempre "yyyy-mm-dd". */
  async listAppointmentsForDay(day: string): Promise<AppointmentsForDay> {
    const dto = await publicRequest<AppointmentsForDayDto>(
      `${BASE}/appointments?${new URLSearchParams({ day }).toString()}`,
    );
    return toAppointmentsForDay(dto);
  }

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const dto = await publicRequest<AppointmentDto>(`${BASE}/appointments`, {
      method: "POST",
      body: JSON.stringify({
        client_name: input.clientName,
        phone: input.phone,
        space_id: input.spaceId,
        start_at: input.startAt,
        end_at: input.endAt,
        therapist_id: input.therapistId ?? null,
        procedure_id: input.procedureId ?? null,
        preference_note: input.preferenceNote ?? null,
        group_id: input.groupId ?? null,
      }),
    });
    return toAppointment(dto);
  }

  /** Cobre editar E "remarcar" (só mudar `startAt`/`endAt`) — mesmo
   * endpoint, a diferença é só quais campos são enviados. */
  async updateAppointment(appointmentId: string, input: UpdateAppointmentInput): Promise<Appointment> {
    const dto = await publicRequest<AppointmentDto>(`${BASE}/appointments/${appointmentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        client_name: input.clientName ?? null,
        phone: input.phone ?? null,
        space_id: input.spaceId ?? null,
        start_at: input.startAt ?? null,
        end_at: input.endAt ?? null,
        therapist_id: input.therapistId ?? null,
        clear_therapist: input.clearTherapist ?? false,
        procedure_id: input.procedureId ?? null,
        preference_note: input.preferenceNote ?? null,
        status: input.status ?? null,
      }),
    });
    return toAppointment(dto);
  }

  async markAppointmentNoShow(appointmentId: string): Promise<Appointment> {
    const dto = await publicRequest<AppointmentDto>(`${BASE}/appointments/${appointmentId}/no-show`, {
      method: "POST",
    });
    return toAppointment(dto);
  }

  async deleteAppointment(appointmentId: string): Promise<void> {
    await publicRequest<void>(`${BASE}/appointments/${appointmentId}`, { method: "DELETE" });
  }

  /** "Excluir o conjunto" de um procedimento "casado" — apaga todos os
   * trechos que compartilham o mesmo `groupId` de uma vez. */
  async deleteAppointmentGroup(groupId: string): Promise<void> {
    await publicRequest<void>(`${BASE}/appointments/group/${groupId}`, { method: "DELETE" });
  }

  /** "Volta mais tarde" — reserva rápida sem espaço/terapeuta, só pra
   * procedimento curto (o backend valida de novo, mas a tela já filtra
   * pela mesma regra antes de oferecer este atalho). */
  async createReturnReservation(input: CreateReturnReservationInput): Promise<ReturnReservationAction> {
    const dto = await publicRequest<ReturnReservationActionDto>(`${BASE}/return-reservations`, {
      method: "POST",
      body: JSON.stringify({
        client_name: input.clientName,
        phone: input.phone,
        procedure_id: input.procedureId,
        minutes: input.minutes,
      }),
    });
    return toReturnReservationAction(dto);
  }

  /** Serve tanto pra "cliente voltou" quanto "cancelar" — mesma operação
   * no backend, só o texto do botão/toast muda no frontend. */
  async resolveReturnReservation(reservationId: string): Promise<PanelState> {
    const dto = await publicRequest<PanelStateDto>(
      `${BASE}/return-reservations/${reservationId}/resolve`,
      { method: "POST" },
    );
    return toPanelState(dto);
  }
}

export const terapeutaDaVezPublicRepository = new TerapeutaDaVezPublicRepository();
