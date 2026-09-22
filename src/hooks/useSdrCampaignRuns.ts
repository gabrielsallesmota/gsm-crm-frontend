import { sdrService } from "../services/SdrService";
import type { SdrCampaignRun } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Histórico de execuções de UMA campanha — mais recente primeiro (ordem
 * já vem assim do backend). */
export function useSdrCampaignRuns(campaignId: string | null): AsyncResourceState<SdrCampaignRun[]> {
  return useAsyncResource(
    () => (campaignId ? sdrService.listCampaignRuns(campaignId) : Promise.resolve([])),
    [campaignId],
  );
}
