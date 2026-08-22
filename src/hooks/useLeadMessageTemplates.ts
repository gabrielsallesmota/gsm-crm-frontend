import { leadsService } from "../services/LeadsService";
import type { LeadMessageTemplate } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useLeadMessageTemplates(): AsyncResourceState<LeadMessageTemplate[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => leadsService.listMessageTemplates(), [currentTenantId]);
}
