import type { ProspectsRepository } from "../repositories/ProspectsRepository";
import { ProspectsApiRepository } from "../repositories/api/ProspectsApiRepository";
import { ProspectsMockRepository } from "../repositories/mock/ProspectsMockRepository";
import { selectRepository } from "./factory";
import type {
  CreateMessageTemplateInput,
  CreateProspectInput,
  CreateProspectStageInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  MessageTemplate,
  Prospect,
  ProspectDashboardMetrics,
  ProspectDuplicateCheck,
  ProspectListFilter,
  ProspectStage,
  UpdateMessageTemplateInput,
  UpdateProspectInput,
  UpdateProspectStageInput,
} from "../types/prospect";
import type { Page } from "../types/common";
import type { Period } from "../utils/periods";

const repo: ProspectsRepository = selectRepository(
  () => new ProspectsMockRepository(),
  () => new ProspectsApiRepository(),
);

export class ProspectsService {
  list(filter: ProspectListFilter): Promise<Page<Prospect>> {
    return repo.list(filter);
  }

  get(id: string): Promise<Prospect> {
    return repo.get(id);
  }

  create(input: CreateProspectInput): Promise<Prospect> {
    return repo.create(input);
  }

  update(id: string, input: UpdateProspectInput): Promise<Prospect> {
    return repo.update(id, input);
  }

  move(id: string, stageId: string, targetDate?: string | null): Promise<Prospect> {
    return repo.move(id, stageId, targetDate);
  }

  delete(id: string): Promise<void> {
    return repo.delete(id);
  }

  checkDuplicate(phone: string): Promise<ProspectDuplicateCheck> {
    return repo.checkDuplicate(phone);
  }

  bulkImport(
    rows: ImportRowInput[],
    defaultStageId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    return repo.bulkImport(rows, defaultStageId, dedupeStrategy);
  }

  exportCsv(): Promise<string> {
    return repo.exportCsv();
  }

  backfillCadence(): Promise<number> {
    return repo.backfillCadence();
  }

  listStages(): Promise<ProspectStage[]> {
    return repo.listStages();
  }

  createStage(input: CreateProspectStageInput): Promise<ProspectStage> {
    return repo.createStage(input);
  }

  updateStage(id: string, input: UpdateProspectStageInput): Promise<ProspectStage> {
    return repo.updateStage(id, input);
  }

  deleteStage(id: string): Promise<void> {
    return repo.deleteStage(id);
  }

  reorderStages(orderedIds: string[]): Promise<void> {
    return repo.reorderStages(orderedIds);
  }

  getDashboardMetrics(period?: Period): Promise<ProspectDashboardMetrics> {
    return repo.getDashboardMetrics(period);
  }

  listMessageTemplates(): Promise<MessageTemplate[]> {
    return repo.listMessageTemplates();
  }

  createMessageTemplate(input: CreateMessageTemplateInput): Promise<MessageTemplate> {
    return repo.createMessageTemplate(input);
  }

  updateMessageTemplate(id: string, input: UpdateMessageTemplateInput): Promise<MessageTemplate> {
    return repo.updateMessageTemplate(id, input);
  }

  deleteMessageTemplate(id: string): Promise<void> {
    return repo.deleteMessageTemplate(id);
  }
}

export const prospectsService = new ProspectsService();
