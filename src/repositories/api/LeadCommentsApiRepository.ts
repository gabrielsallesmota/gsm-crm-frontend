import type { LeadCommentsRepository } from "../LeadCommentsRepository";
import type { LeadComment } from "../../types/lead";
import { apiRequest } from "./ApiClient";

interface LeadCommentDto {
  id: string;
  lead_id: string;
  author_user_id: string;
  author_name: string;
  text: string;
  created_at: string;
}

function toLeadComment(dto: LeadCommentDto): LeadComment {
  return {
    id: dto.id,
    leadId: dto.lead_id,
    authorUserId: dto.author_user_id,
    authorName: dto.author_name,
    text: dto.text,
    createdAt: dto.created_at,
  };
}

export class LeadCommentsApiRepository implements LeadCommentsRepository {
  async list(leadId: string): Promise<LeadComment[]> {
    const dtos = await apiRequest<LeadCommentDto[]>(`/api/v1/leads/${leadId}/comments`);
    return dtos.map(toLeadComment);
  }

  async create(leadId: string, text: string): Promise<LeadComment> {
    const dto = await apiRequest<LeadCommentDto>(`/api/v1/leads/${leadId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return toLeadComment(dto);
  }
}
