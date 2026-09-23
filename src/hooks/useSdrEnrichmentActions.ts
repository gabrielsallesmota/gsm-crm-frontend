import { sdrService } from "../services/SdrService";
import type { SdrCandidate, SdrDuplicateSuggestion, SetCandidateCnpjResult } from "../types/sdr";

export interface SdrEnrichmentActions {
  setCnpj(id: string, cnpj: string): Promise<SetCandidateCnpjResult>;
  refresh(id: string, force?: boolean): Promise<SdrCandidate>;
  confirmDuplicate(candidateId: string, suggestionId: string): Promise<SdrDuplicateSuggestion>;
  dismissDuplicate(candidateId: string, suggestionId: string): Promise<SdrDuplicateSuggestion>;
}

export function useSdrEnrichmentActions(): SdrEnrichmentActions {
  return {
    setCnpj: (id, cnpj) => sdrService.setCandidateCnpj(id, cnpj),
    refresh: (id, force) => sdrService.refreshCandidateEnrichment(id, force),
    confirmDuplicate: (candidateId, suggestionId) =>
      sdrService.confirmDuplicateSuggestion(candidateId, suggestionId),
    dismissDuplicate: (candidateId, suggestionId) =>
      sdrService.dismissDuplicateSuggestion(candidateId, suggestionId),
  };
}
