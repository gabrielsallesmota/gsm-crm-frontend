import type { LeadCommentsRepository } from "../repositories/LeadCommentsRepository";
import { LeadCommentsApiRepository } from "../repositories/api/LeadCommentsApiRepository";
import { LeadCommentsMockRepository } from "../repositories/mock/LeadCommentsMockRepository";
import { selectRepository } from "./factory";
import type { LeadComment } from "../types/lead";

const repo: LeadCommentsRepository = selectRepository(
  () => new LeadCommentsMockRepository(),
  () => new LeadCommentsApiRepository(),
);

export class LeadCommentsService {
  list(leadId: string): Promise<LeadComment[]> {
    return repo.list(leadId);
  }

  create(leadId: string, text: string): Promise<LeadComment> {
    return repo.create(leadId, text);
  }
}

export const leadCommentsService = new LeadCommentsService();
