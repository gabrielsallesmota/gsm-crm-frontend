import { ApiError } from "../../types/common";
import { BASE_URL } from "./ApiClient";
import { toAttendanceAction, toPanelState, type AttendanceActionDto, type PanelStateDto } from "./operationsMapping";
import type { AttendanceAction, PanelState } from "../../types/operations";

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

  async call(therapistId: string, clientName: string, phone: string): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/call`, {
      method: "POST",
      body: JSON.stringify({ therapist_id: therapistId, client_name: clientName, phone }),
    });
    return toAttendanceAction(dto);
  }

  async decline(attendanceId: string): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/decline`, {
      method: "POST",
    });
    return toAttendanceAction(dto);
  }

  async start(attendanceId: string, procedureId: string, spaceIds: string[]): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/start`, {
      method: "POST",
      body: JSON.stringify({ procedure_id: procedureId, space_ids: spaceIds }),
    });
    return toAttendanceAction(dto);
  }

  async finish(attendanceId: string): Promise<AttendanceAction> {
    const dto = await publicRequest<AttendanceActionDto>(`${BASE}/attendances/${attendanceId}/finish`, {
      method: "POST",
    });
    return toAttendanceAction(dto);
  }
}

export const terapeutaDaVezPublicRepository = new TerapeutaDaVezPublicRepository();
