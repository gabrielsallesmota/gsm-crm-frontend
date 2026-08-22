import type { LeadsRepository } from "../repositories/LeadsRepository";
import { LeadsApiRepository } from "../repositories/api/LeadsApiRepository";
import { LeadsMockRepository } from "../repositories/mock/LeadsMockRepository";
import { selectRepository } from "./factory";
import type {
  CreateLeadInput,
  CreateLeadMessageTemplateInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  Lead,
  LeadListFilter,
  LeadMessageTemplate,
  UpdateLeadInput,
  UpdateLeadMessageTemplateInput,
} from "../types/lead";
import type { Page } from "../types/common";
import type { StageKey } from "../types/pipeline";

const repo: LeadsRepository = selectRepository(
  () => new LeadsMockRepository(),
  () => new LeadsApiRepository(),
);

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

  bulkImport(
    rows: ImportRowInput[],
    pipelineId: string,
    defaultStageId: string,
    defaultOwnerId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    return repo.bulkImport(rows, pipelineId, defaultStageId, defaultOwnerId, dedupeStrategy);
  }

  exportCsv(): Promise<string> {
    return repo.exportCsv();
  }

  listMessageTemplates(): Promise<LeadMessageTemplate[]> {
    return repo.listMessageTemplates();
  }

  createMessageTemplate(input: CreateLeadMessageTemplateInput): Promise<LeadMessageTemplate> {
    return repo.createMessageTemplate(input);
  }

  updateMessageTemplate(
    id: string,
    input: UpdateLeadMessageTemplateInput,
  ): Promise<LeadMessageTemplate> {
    return repo.updateMessageTemplate(id, input);
  }

  deleteMessageTemplate(id: string): Promise<void> {
    return repo.deleteMessageTemplate(id);
  }
}

export const leadsService = new LeadsService();
