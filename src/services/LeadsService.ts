import type { LeadsRepository } from "../repositories/LeadsRepository";
import { LeadsApiRepository } from "../repositories/api/LeadsApiRepository";
import { LeadsMockRepository } from "../repositories/mock/LeadsMockRepository";
import { CRM_MODE } from "./factory";
import type { CreateLeadInput, Lead, LeadListFilter, UpdateLeadInput } from "../types/lead";
import type { Page } from "../types/common";
import type { StageKey } from "../types/pipeline";

const repo: LeadsRepository = CRM_MODE === "demo" ? new LeadsMockRepository() : new LeadsApiRepository();

export class LeadsService {
  list(filter: LeadListFilter): Promise<Page<Lead>> {
    return repo.list(filter);
  }

  get(id: string): Promise<Lead> {
    return repo.get(id);
  }

  create(input: CreateLeadInput): Promise<Lead> {
    return repo.create(input);
  }

  update(id: string, input: UpdateLeadInput): Promise<Lead> {
    return repo.update(id, input);
  }

  move(id: string, stage: StageKey): Promise<Lead> {
    return repo.move(id, stage);
  }

  delete(id: string): Promise<void> {
    return repo.delete(id);
  }
}

export const leadsService = new LeadsService();
