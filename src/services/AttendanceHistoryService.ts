import { operationsApiRepository } from "../repositories/api/OperationsApiRepository";
import type { HistoryFilter, HistoryPage } from "../types/operations";

export class AttendanceHistoryService {
  list(filter: HistoryFilter): Promise<HistoryPage> {
    return operationsApiRepository.listHistory(filter);
  }
}

export const attendanceHistoryService = new AttendanceHistoryService();
