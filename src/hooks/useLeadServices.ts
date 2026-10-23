import { leadServicesService } from "../services/LeadServicesService";
import type { LeadService } from "../types/leadService";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useLeadServices(): AsyncResourceState<LeadService[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => leadServicesService.list(), [currentTenantId]);
}

/** Ids de quem está indisponível para receber leads (só admin/gestor consultam). */
export function useLeadAvailability(enabled: boolean): AsyncResourceState<string[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    async () => (enabled ? leadServicesService.unavailableUserIds() : []),
    [currentTenantId, enabled],
  );
}
