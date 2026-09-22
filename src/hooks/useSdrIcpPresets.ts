import { sdrService } from "../services/SdrService";
import type { SdrIcpPreset } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useSdrIcpPresets(): AsyncResourceState<SdrIcpPreset[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => sdrService.listIcpPresets(), [currentTenantId]);
}
