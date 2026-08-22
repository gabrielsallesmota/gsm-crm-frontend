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

export interface LeadsRepository {
  list(filter: LeadListFilter): Promise<Page<Lead>>;
  get(id: string): Promise<Lead>;
  create(input: CreateLeadInput): Promise<Lead>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  move(id: string, stage: StageKey): Promise<Lead>;
  delete(id: string): Promise<void>;

  bulkImport(
    rows: ImportRowInput[],
    pipelineId: string,
    defaultStageId: string,
    defaultOwnerId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary>;
  exportCsv(): Promise<string>;

  listMessageTemplates(): Promise<LeadMessageTemplate[]>;
  createMessageTemplate(input: CreateLeadMessageTemplateInput): Promise<LeadMessageTemplate>;
  updateMessageTemplate(
    id: string,
    input: UpdateLeadMessageTemplateInput,
  ): Promise<LeadMessageTemplate>;
  deleteMessageTemplate(id: string): Promise<void>;
}
