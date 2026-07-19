import type { CreateLeadInput, Lead, LeadListFilter, UpdateLeadInput } from "../types/lead";
import type { Page } from "../types/common";
import type { StageKey } from "../types/pipeline";

export interface LeadsRepository {
  list(filter: LeadListFilter): Promise<Page<Lead>>;
  get(id: string): Promise<Lead>;
  create(input: CreateLeadInput): Promise<Lead>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  move(id: string, stage: StageKey): Promise<Lead>;
  delete(id: string): Promise<void>;
}
