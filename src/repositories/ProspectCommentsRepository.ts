import type { ProspectComment } from "../types/prospect";

export interface ProspectCommentsRepository {
  list(prospectId: string): Promise<ProspectComment[]>;
  create(prospectId: string, text: string): Promise<ProspectComment>;
}
