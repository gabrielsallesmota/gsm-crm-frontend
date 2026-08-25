import { leadCommentsService } from "../services/LeadCommentsService";
import type { LeadComment } from "../types/lead";

export interface LeadCommentActions {
  create(leadId: string, text: string): Promise<LeadComment>;
}

export function useLeadCommentActions(): LeadCommentActions {
  return {
    create: (leadId, text) => leadCommentsService.create(leadId, text),
  };
}
