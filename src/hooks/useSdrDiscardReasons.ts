import { sdrService } from "../services/SdrService";
import type { SdrDiscardReason } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useSdrDiscardReasons(): AsyncResourceState<SdrDiscardReason[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => sdrService.listDiscardReasons(), [currentTenantId]);
}
