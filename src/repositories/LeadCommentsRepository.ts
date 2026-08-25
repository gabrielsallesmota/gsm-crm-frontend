import type { LeadComment } from "../types/lead";

export interface LeadCommentsRepository {
  list(leadId: string): Promise<LeadComment[]>;
  create(leadId: string, text: string): Promise<LeadComment>;
}
