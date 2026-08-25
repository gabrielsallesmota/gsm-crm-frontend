import { prospectCommentsService } from "../services/ProspectCommentsService";
import type { ProspectComment } from "../types/prospect";

export interface ProspectCommentActions {
  create(prospectId: string, text: string): Promise<ProspectComment>;
}

export function useProspectCommentActions(): ProspectCommentActions {
  return {
    create: (prospectId, text) => prospectCommentsService.create(prospectId, text),
  };
}
