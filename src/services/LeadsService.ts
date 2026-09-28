import type { LeadsRepository } from "../repositories/LeadsRepository";
import { LeadsApiRepository } from "../repositories/api/LeadsApiRepository";
import { LeadsMockRepository } from "../repositories/mock/LeadsMockRepository";
import { selectRepository } from "./factory";

/** Repasse direto ao repositório do modo atual (API real ou demonstração)
 * — a interface `LeadsRepository` é o contrato. */
export const leadsService: LeadsRepository = selectRepository(
  () => new LeadsMockRepository(),
  () => new LeadsApiRepository(),
);
