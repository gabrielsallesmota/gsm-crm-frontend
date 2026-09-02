import type { ProspectsRepository } from "../ProspectsRepository";
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
} from "../../types/prospect";
import type { Page } from "../../types/common";
import type { Period } from "../../utils/periods";
import { NotImplementedError } from "../../utils/errors";

const REASON =
  "Prospecção GSM é a carteira comercial interna da GSM Automação — não faz parte da demonstração pública do CRM.";

/**
 * Diferente dos outros mocks deste diretório (que existem porque o BACKEND
 * ainda não implementa aquele recurso): aqui é o oposto — o backend já tem o
 * módulo `prospects` completo, mas ele nunca deve aparecer no modo Demo
 * (é dado comercial interno da GSM, não algo para mostrar a um visitante do
 * site). Reaproveita o mesmo mecanismo de `NotImplementedError`
 * (`useAsyncResource` já sabe tratar isso como "recurso indisponível", não
 * como erro) só que com um motivo diferente, passado explicitamente.
 */
export class ProspectsMockRepository implements ProspectsRepository {
  async list(_filter: ProspectListFilter): Promise<Page<Prospect>> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async get(_id: string): Promise<Prospect> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async create(_input: CreateProspectInput): Promise<Prospect> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async update(_id: string, _input: UpdateProspectInput): Promise<Prospect> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async move(_id: string, _stageId: string, _targetDate?: string | null): Promise<Prospect> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async delete(_id: string): Promise<void> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async checkDuplicate(_phone: string): Promise<ProspectDuplicateCheck> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async bulkImport(
    _rows: ImportRowInput[],
    _defaultStageId: string,
    _dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async exportCsv(): Promise<string> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async backfillCadence(): Promise<number> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async listStages(): Promise<ProspectStage[]> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async createStage(_input: CreateProspectStageInput): Promise<ProspectStage> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async updateStage(_id: string, _input: UpdateProspectStageInput): Promise<ProspectStage> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async deleteStage(_id: string): Promise<void> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async reorderStages(_orderedIds: string[]): Promise<void> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async getDashboardMetrics(_period?: Period): Promise<ProspectDashboardMetrics> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async listMessageTemplates(): Promise<MessageTemplate[]> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async createMessageTemplate(_input: CreateMessageTemplateInput): Promise<MessageTemplate> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async updateMessageTemplate(
    _id: string,
    _input: UpdateMessageTemplateInput,
  ): Promise<MessageTemplate> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }

  async deleteMessageTemplate(_id: string): Promise<void> {
    throw new NotImplementedError("Prospecção GSM", REASON);
  }
}
