import { leadsService } from "../services/LeadsService";
import type { LeadTimelineItem } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Timeline comercial REAL do lead (eventos + comentários). */
export function useLeadTimeline(leadId: string): AsyncResourceState<LeadTimelineItem[]> {
  return useAsyncResource(() => leadsService.timeline(leadId), [leadId]);
}
