import { reportsService } from "../services/ReportsService";
import type { ReportCard } from "../types/report";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useReports(): AsyncResourceState<ReportCard[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => reportsService.getReportCards(), [currentTenantId]);
}
