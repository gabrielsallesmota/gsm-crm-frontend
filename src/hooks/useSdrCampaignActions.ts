import { sdrService } from "../services/SdrService";
import type { CreateSdrCampaignInput, SdrCampaign, UpdateSdrCampaignInput } from "../types/sdr";

export interface SdrCampaignActions {
  get(id: string): Promise<SdrCampaign>;
  create(input: CreateSdrCampaignInput): Promise<SdrCampaign>;
  update(id: string, input: UpdateSdrCampaignInput): Promise<SdrCampaign>;
  delete(id: string): Promise<void>;
}

export function useSdrCampaignActions(): SdrCampaignActions {
  return {
    get: (id) => sdrService.getCampaign(id),
    create: (input) => sdrService.createCampaign(input),
    update: (id, input) => sdrService.updateCampaign(id, input),
    delete: (id) => sdrService.deleteCampaign(id),
  };
}
