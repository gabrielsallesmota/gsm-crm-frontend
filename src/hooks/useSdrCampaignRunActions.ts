import { sdrService } from "../services/SdrService";
import type { SdrCampaignRun, StartSdrCampaignRunInput } from "../types/sdr";

export interface SdrCampaignRunActions {
  start(campaignId: string, input: StartSdrCampaignRunInput): Promise<SdrCampaignRun>;
}

export function useSdrCampaignRunActions(): SdrCampaignRunActions {
  return {
    start: (campaignId, input) => sdrService.startCampaignRun(campaignId, input),
  };
}
