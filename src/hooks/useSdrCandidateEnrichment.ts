import { sdrService } from "../services/SdrService";
import type { SdrCandidateEnrichment, SdrDuplicateSuggestion } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrCandidateEnrichments(id: string): AsyncResourceState<SdrCandidateEnrichment[]> {
  return useAsyncResource(() => sdrService.listCandidateEnrichments(id), [id]);
}

export function useSdrDuplicateSuggestions(id: string): AsyncResourceState<SdrDuplicateSuggestion[]> {
  return useAsyncResource(() => sdrService.listDuplicateSuggestions(id), [id]);
}
