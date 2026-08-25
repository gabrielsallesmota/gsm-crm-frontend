import { leadCommentsService } from "../services/LeadCommentsService";
import type { LeadComment } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useLeadComments(leadId: string): AsyncResourceState<LeadComment[]> {
  return useAsyncResource(() => leadCommentsService.list(leadId), [leadId]);
}
