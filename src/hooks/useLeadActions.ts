import { leadsService } from "../services/LeadsService";
import type {
  CreateLeadInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  Lead,
  UpdateLeadInput,
} from "../types/lead";

export interface LeadActions {
  create(input: CreateLeadInput): Promise<Lead>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  /** `stageId` é o UUID REAL da etapa (nunca um nome/chave). */
  move(id: string, stageId: string): Promise<Lead>;
  delete(id: string): Promise<void>;
  bulkImport(
    rows: ImportRowInput[],
    pipelineId: string,
    defaultStageId: string,
    defaultOwnerId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary>;
  exportCsv(): Promise<string>;
}

/**
 * Mutações de lead usadas fora de `useLeads` (ex.: `LeadDrawer`) — só o hook
 * fala com `leadsService`, componentes/páginas só chamam o hook.
 */
export function useLeadActions(): LeadActions {
  return {
    create: (input) => leadsService.create(input),
    update: (id, input) => leadsService.update(id, input),
    move: (id, stageId) => leadsService.move(id, stageId),
    delete: (id) => leadsService.delete(id),
    bulkImport: (rows, pipelineId, defaultStageId, defaultOwnerId, dedupeStrategy) =>
      leadsService.bulkImport(rows, pipelineId, defaultStageId, defaultOwnerId, dedupeStrategy),
    exportCsv: () => leadsService.exportCsv(),
  };
}
