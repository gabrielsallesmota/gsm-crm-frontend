import type { ProspectCommentsRepository } from "../repositories/ProspectCommentsRepository";
import { ProspectCommentsApiRepository } from "../repositories/api/ProspectCommentsApiRepository";
import { ProspectCommentsMockRepository } from "../repositories/mock/ProspectCommentsMockRepository";
import { selectRepository } from "./factory";
import type { ProspectComment } from "../types/prospect";

const repo: ProspectCommentsRepository = selectRepository(
  () => new ProspectCommentsMockRepository(),
  () => new ProspectCommentsApiRepository(),
);

export class ProspectCommentsService {
  list(prospectId: string): Promise<ProspectComment[]> {
    return repo.list(prospectId);
  }

  create(prospectId: string, text: string): Promise<ProspectComment> {
    return repo.create(prospectId, text);
  }
}

export const prospectCommentsService = new ProspectCommentsService();
