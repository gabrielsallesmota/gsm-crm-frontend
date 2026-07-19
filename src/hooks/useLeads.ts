import { leadsService } from "../services/LeadsService";
import type { LeadListFilter, Lead } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import type { Page } from "../types/common";
import { useAuth } from "./useAuth";

export function useLeads(filter: LeadListFilter): AsyncResourceState<Page<Lead>> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => leadsService.list(filter), [JSON.stringify(filter), currentTenantId]);
}
