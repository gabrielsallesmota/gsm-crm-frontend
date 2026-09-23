import { sdrService } from "../services/SdrService";
import type { SdrCandidateAudit } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrCandidateAudits(id: string): AsyncResourceState<SdrCandidateAudit[]> {
  return useAsyncResource(() => sdrService.listCandidateAudits(id), [id]);
}
