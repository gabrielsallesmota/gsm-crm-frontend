import type {
  CreateMessageTemplateInput,
  CreateProspectInput,
  CreateProspectLossReasonInput,
  CreateProspectStageInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  MessageTemplate,
  Prospect,
  ProspectDashboardMetrics,
  ProspectDuplicateCheck,
  ProspectListFilter,
  ProspectLossReason,
  ProspectStage,
  UpdateMessageTemplateInput,
  UpdateProspectInput,
  UpdateProspectLossReasonInput,
  UpdateProspectStageInput,
} from "../types/prospect";
import type { Page } from "../types/common";
import type { Period } from "../utils/periods";

export interface ProspectsRepository {
  list(filter: ProspectListFilter): Promise<Page<Prospect>>;
  get(id: string): Promise<Prospect>;
  create(input: CreateProspectInput): Promise<Prospect>;
  update(id: string, input: UpdateProspectInput): Promise<Prospect>;
  move(
    id: string,
    stageId: string,
    targetDate?: string | null,
    lossReasonId?: string | null,
  ): Promise<Prospect>;
  delete(id: string): Promise<void>;
  checkDuplicate(phone: string): Promise<ProspectDuplicateCheck>;
  bulkImport(
    rows: ImportRowInput[],
    defaultStageId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary>;
  exportCsv(): Promise<string>;
  // Empurrão único de `initial_contact_date`/`target_date` pra prospects
  // cadastrados antes da cadência automática existir — ver
  // `BackfillProspectCadenceUseCase` no backend. Devolve quantos foram
  // atualizados.
  backfillCadence(): Promise<number>;

  listStages(): Promise<ProspectStage[]>;
  createStage(input: CreateProspectStageInput): Promise<ProspectStage>;
  updateStage(id: string, input: UpdateProspectStageInput): Promise<ProspectStage>;
  deleteStage(id: string): Promise<void>;
  reorderStages(orderedIds: string[]): Promise<void>;

  getDashboardMetrics(period?: Period): Promise<ProspectDashboardMetrics>;

  listMessageTemplates(): Promise<MessageTemplate[]>;
  createMessageTemplate(input: CreateMessageTemplateInput): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, input: UpdateMessageTemplateInput): Promise<MessageTemplate>;
  deleteMessageTemplate(id: string): Promise<void>;

  listLossReasons(): Promise<ProspectLossReason[]>;
  createLossReason(input: CreateProspectLossReasonInput): Promise<ProspectLossReason>;
  updateLossReason(id: string, input: UpdateProspectLossReasonInput): Promise<ProspectLossReason>;
  deleteLossReason(id: string): Promise<void>;
}
