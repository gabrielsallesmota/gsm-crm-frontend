import { dashboardService } from "../services/DashboardService";
import type { DashboardMetrics } from "../types/dashboard";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useDashboard(): AsyncResourceState<DashboardMetrics> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => dashboardService.getMetrics(), [currentTenantId]);
}
