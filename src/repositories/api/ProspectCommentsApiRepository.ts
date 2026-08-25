import type { ProspectCommentsRepository } from "../ProspectCommentsRepository";
import type { ProspectComment } from "../../types/prospect";
import { apiRequest } from "./ApiClient";

interface ProspectCommentDto {
  id: string;
  prospect_id: string;
  author_user_id: string;
  author_name: string;
  text: string;
  created_at: string;
}

function toProspectComment(dto: ProspectCommentDto): ProspectComment {
  return {
    id: dto.id,
    prospectId: dto.prospect_id,
    authorUserId: dto.author_user_id,
    authorName: dto.author_name,
    text: dto.text,
    createdAt: dto.created_at,
  };
}

export class ProspectCommentsApiRepository implements ProspectCommentsRepository {
  async list(prospectId: string): Promise<ProspectComment[]> {
    const dtos = await apiRequest<ProspectCommentDto[]>(`/api/v1/prospects/${prospectId}/comments`);
    return dtos.map(toProspectComment);
  }

  async create(prospectId: string, text: string): Promise<ProspectComment> {
    const dto = await apiRequest<ProspectCommentDto>(`/api/v1/prospects/${prospectId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return toProspectComment(dto);
  }
}
