import { sdrService } from "../services/SdrService";
import type { SdrCandidate } from "../types/sdr";

export interface SdrAuditActions {
  setWebsite(id: string, website: string): Promise<SdrCandidate>;
  refresh(id: string, force?: boolean): Promise<SdrCandidate>;
}

export function useSdrAuditActions(): SdrAuditActions {
  return {
    setWebsite: (id, website) => sdrService.setCandidateWebsite(id, website),
    refresh: (id, force) => sdrService.refreshCandidateAudit(id, force),
  };
}
