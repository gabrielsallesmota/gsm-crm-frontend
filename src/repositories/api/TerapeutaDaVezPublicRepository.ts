import { ApiError } from "../../types/common";
import { BASE_URL } from "./ApiClient";
import {
  toAttendanceAction,
  toPanelState,
  toTherapistAction,
  toWaitlistAction,
  type AttendanceActionDto,
  type PanelStateDto,
  type TherapistActionDto,
  type WaitlistActionDto,
} from "./operationsMapping";
import type {
  AttendanceAction,
  CreateWaitlistEntryInput,
  PanelState,
  Shift,
  TherapistAction,
  WaitlistAction,
} from "../../types/operations";

const BASE = "/api/v1/public/terapeuta-da-vez";

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

  /** `clientName` — nome do paciente, digitado junto com a escolha do
   * espaço (nunca vira cliente cadastrado, ver `types/operations.ts`). */
  async start(
    attendanceId: string,
    procedureId: string,
    spaceIds: string[],
    clientName: string,
  ): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/start`, {
      method: "POST",
      body: JSON.stringify({ procedure_id: procedureId, space_ids: spaceIds, client_name: clientName }),
    });
    return toAttendanceAction(dto);
  }

  async finish(attendanceId: string, awardPoints: boolean): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/finish`, {
      method: "POST",
      body: JSON.stringify({ award_points: awardPoints }),
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
}

export const terapeutaDaVezPublicRepository = new TerapeutaDaVezPublicRepository();
