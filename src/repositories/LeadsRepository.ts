import type {
  CreateLeadInput,
  CreateLeadMessageTemplateInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  Lead,
  LeadListFilter,
  LeadTimelineItem,
  LeadMessageTemplate,
  UpdateLeadInput,
  UpdateLeadMessageTemplateInput,
} from "../types/lead";
import type { Page } from "../types/common";

export interface LeadsRepository {
  list(filter: LeadListFilter): Promise<Page<Lead>>;
  get(id: string): Promise<Lead>;
  create(input: CreateLeadInput): Promise<Lead>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  /** Move para uma etapa REAL (UUID) do pipeline do lead. */
  move(id: string, stageId: string): Promise<Lead>;
  timeline(id: string): Promise<LeadTimelineItem[]>;
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
