import { sdrService } from "../services/SdrService";
import type { SdrCoverage } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useSdrCoverage(): AsyncResourceState<SdrCoverage[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => sdrService.listCoverage(), [currentTenantId]);
}
