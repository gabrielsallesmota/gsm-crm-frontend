import type { ProspectCommentsRepository } from "../ProspectCommentsRepository";
import type { ProspectComment } from "../../types/prospect";
import { NotImplementedError } from "../../utils/errors";

const REASON =
  "Prospecção GSM é a carteira comercial interna da GSM Automação — não faz parte da demonstração pública do CRM.";

/** Mesmo racional de `ProspectsMockRepository` — nunca disponível no modo
 * Demo (dado comercial interno da GSM), não porque o backend não tenha. */
export class ProspectCommentsMockRepository implements ProspectCommentsRepository {
  async list(_prospectId: string): Promise<ProspectComment[]> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async create(_prospectId: string, _text: string): Promise<ProspectComment> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }
}
