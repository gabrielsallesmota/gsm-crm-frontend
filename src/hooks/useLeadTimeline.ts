import { leadsService } from "../services/LeadsService";
import type { LeadTimelineItem } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/**
 * Timeline comercial REAL do lead (eventos + comentários). Sem `limit` o backend devolve os 100
 * mais recentes; `limit` (até 500) amplia a janela — é o "Ver mais" do painel.
 */
export function useLeadTimeline(
  leadId: string,
  limit?: number,
): AsyncResourceState<LeadTimelineItem[]> {
  return useAsyncResource(
    () => (limit ? leadsService.timeline(leadId, limit) : leadsService.timeline(leadId)),
    [leadId, limit],
  );
}
