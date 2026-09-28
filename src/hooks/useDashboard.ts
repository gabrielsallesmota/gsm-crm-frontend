import { dashboardService } from "../services/DashboardService";
import type { DashboardMetrics } from "../types/dashboard";
import type { Period } from "../utils/periods";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useDashboard(
  period?: Period,
  pipelineId?: string,
): AsyncResourceState<DashboardMetrics> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    () => dashboardService.getMetrics(period, pipelineId),
    [currentTenantId, period?.dateFrom, period?.dateTo, pipelineId],
  );
}
