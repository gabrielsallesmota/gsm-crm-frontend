import { prospectsService } from "../services/ProspectsService";
import type { ProspectLossReason } from "../types/prospect";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useProspectLossReasons(): AsyncResourceState<ProspectLossReason[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => prospectsService.listLossReasons(), [currentTenantId]);
}
