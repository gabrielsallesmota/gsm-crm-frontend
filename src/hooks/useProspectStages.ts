import { prospectsService } from "../services/ProspectsService";
import type { ProspectStage } from "../types/prospect";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useProspectStages(): AsyncResourceState<ProspectStage[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => prospectsService.listStages(), [currentTenantId]);
}
