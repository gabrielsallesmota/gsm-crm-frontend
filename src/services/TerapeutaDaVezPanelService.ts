import { terapeutaDaVezPublicRepository } from "../repositories/api/TerapeutaDaVezPublicRepository";
import type { AttendanceAction, PanelState } from "../types/operations";

/** Painel aberto (sem login) — chamar/recusar/iniciar/finalizar e o estado
 * completo da fila. Ver `TerapeutaDaVezPublicRepository`. */
export class TerapeutaDaVezPanelService {
  getState(): Promise<PanelState> {
    return terapeutaDaVezPublicRepository.getState();
  }

  call(therapistId: string, clientName: string, phone: string): Promise<AttendanceAction> {
    return terapeutaDaVezPublicRepository.call(therapistId, clientName, phone);
  }

  decline(attendanceId: string): Promise<AttendanceAction> {
    return terapeutaDaVezPublicRepository.decline(attendanceId);
  }

  start(attendanceId: string, procedureId: string, spaceIds: string[]): Promise<AttendanceAction> {
    return terapeutaDaVezPublicRepository.start(attendanceId, procedureId, spaceIds);
  }

  finish(attendanceId: string): Promise<AttendanceAction> {
    return terapeutaDaVezPublicRepository.finish(attendanceId);
  }
}

export const terapeutaDaVezPanelService = new TerapeutaDaVezPanelService();
