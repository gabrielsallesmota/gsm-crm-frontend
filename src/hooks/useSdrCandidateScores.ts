import { sdrService } from "../services/SdrService";
import type { SdrCandidateScore } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrCandidateScores(id: string): AsyncResourceState<SdrCandidateScore[]> {
  return useAsyncResource(() => sdrService.listCandidateScores(id), [id]);
}
