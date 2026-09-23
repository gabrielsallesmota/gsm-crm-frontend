import { sdrService } from "../services/SdrService";
import type { SdrCandidateOutreachGeneration } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrCandidateOutreach(
  id: string,
): AsyncResourceState<SdrCandidateOutreachGeneration[]> {
  return useAsyncResource(() => sdrService.listCandidateOutreachGenerations(id), [id]);
}
