import { sdrService } from "../services/SdrService";
import type { SdrBulkActionInput, SdrBulkActionSummary, SdrCandidate } from "../types/sdr";

export interface SdrCandidateActions {
  review(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate>;
  approve(id: string, campaignId?: string): Promise<SdrCandidate>;
  discard(id: string, discardReasonId: string, notes?: string, campaignId?: string): Promise<SdrCandidate>;
  reevaluate(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate>;
  bulk(input: SdrBulkActionInput): Promise<SdrBulkActionSummary>;
}

export function useSdrCandidateActions(): SdrCandidateActions {
  return {
    review: (id, notes, campaignId) => sdrService.reviewCandidate(id, notes, campaignId),
    approve: (id, campaignId) => sdrService.approveCandidate(id, campaignId),
    discard: (id, discardReasonId, notes, campaignId) =>
      sdrService.discardCandidate(id, discardReasonId, notes, campaignId),
    reevaluate: (id, notes, campaignId) => sdrService.reevaluateCandidate(id, notes, campaignId),
    bulk: (input) => sdrService.bulkCandidateAction(input),
  };
}
