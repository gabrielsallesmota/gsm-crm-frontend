import { sdrService } from "../services/SdrService";
import type { SdrCandidateAppearance, SdrCandidateDecision } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrCandidateDecisions(id: string): AsyncResourceState<SdrCandidateDecision[]> {
  return useAsyncResource(() => sdrService.listCandidateDecisions(id), [id]);
}

export function useSdrCandidateAppearances(id: string): AsyncResourceState<SdrCandidateAppearance[]> {
  return useAsyncResource(() => sdrService.listCandidateAppearances(id), [id]);
}
