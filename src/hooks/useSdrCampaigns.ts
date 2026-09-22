import { sdrService } from "../services/SdrService";
import type { SdrCampaign } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useSdrCampaigns(): AsyncResourceState<SdrCampaign[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => sdrService.listCampaigns(), [currentTenantId]);
}
