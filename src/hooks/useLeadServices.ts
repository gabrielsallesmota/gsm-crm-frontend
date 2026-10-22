import { leadServicesService } from "../services/LeadServicesService";
import type { LeadService } from "../types/leadService";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useLeadServices(): AsyncResourceState<LeadService[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => leadServicesService.list(), [currentTenantId]);
}
