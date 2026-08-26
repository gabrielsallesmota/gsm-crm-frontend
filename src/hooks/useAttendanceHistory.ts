import { attendanceHistoryService } from "../services/AttendanceHistoryService";
import type { HistoryFilter, HistoryPage } from "../types/operations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useAttendanceHistory(filter: HistoryFilter): AsyncResourceState<HistoryPage> {
  return useAsyncResource(
    () => attendanceHistoryService.list(filter),
    [
      filter.therapistId,
      filter.procedureId,
      filter.clientSearch,
      filter.phase,
      filter.dateFrom,
      filter.dateTo,
      filter.page,
      filter.pageSize,
    ],
  );
}
