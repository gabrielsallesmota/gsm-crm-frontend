import { sdrService } from "../services/SdrService";
import type { Page } from "../types/common";
import type { SdrCandidate, SdrCandidateListFilter } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useSdrCandidates(filter: SdrCandidateListFilter): AsyncResourceState<Page<SdrCandidate>> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    () => sdrService.listCandidates(filter),
    [JSON.stringify(filter), currentTenantId],
  );
}
