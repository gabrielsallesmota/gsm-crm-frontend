import { sdrService } from "../services/SdrService";
import type { SdrDashboardOverview, SdrProviderCostSummary } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useSdrDashboardOverview(): AsyncResourceState<SdrDashboardOverview> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => sdrService.getDashboardOverview(), [currentTenantId]);
}

export function useSdrDashboardCosts(): AsyncResourceState<SdrProviderCostSummary[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => sdrService.getDashboardCosts(), [currentTenantId]);
}
