import type { LeadCommentsRepository } from "../LeadCommentsRepository";
import type { LeadComment } from "../../types/lead";
import { delay } from "../../utils/errors";
import { mockState, nextCommentId } from "./state";

export class LeadCommentsMockRepository implements LeadCommentsRepository {
  async list(leadId: string): Promise<LeadComment[]> {
    await delay(150);
    return mockState.leadComments[leadId] ?? [];
  }

  async create(leadId: string, text: string): Promise<LeadComment> {
    await delay(150);
    const lead = mockState.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error(`Lead ${leadId} não encontrado.`);
    const author = mockState.users[0];
    const comment: LeadComment = {
      id: nextCommentId(),
      leadId,
      authorUserId: author?.id ?? "u1",
      authorName: author?.name ?? "Você",
      text,
      createdAt: new Date().toISOString(),
    };
    const list = mockState.leadComments[leadId] ?? [];
    mockState.leadComments[leadId] = [comment, ...list];
    // Mantém `Lead.lastComment` em sincronia — é o que o card do Kanban lê,
    // sem chamar `list()` (mesma composição que o backend faz em `GET /leads`).
    lead.lastComment = { text: comment.text, createdAt: comment.createdAt };
    return comment;
  }
}
