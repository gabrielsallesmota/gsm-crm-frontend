import { leadsService } from "../services/LeadsService";
import type {
  CreateLeadInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  Lead,
  UpdateLeadInput,
} from "../types/lead";
import type { StageKey } from "../types/pipeline";

export interface LeadActions {
  create(input: CreateLeadInput): Promise<Lead>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  move(id: string, stage: StageKey): Promise<Lead>;
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
 * Mutações de lead usadas fora de `useLeads` (ex.: `LeadDrawer`, que edita
 * um lead sem listar nenhum) — mesma regra de camadas dos hooks de
 * leitura: só o hook fala com `leadsService`, componentes/páginas só
 * chamam o hook.
 */
export function useLeadActions(): LeadActions {
  return {
    create: (input) => leadsService.create(input),
    update: (id, input) => leadsService.update(id, input),
    move: (id, stage) => leadsService.move(id, stage),
    bulkImport: (rows, pipelineId, defaultStageId, defaultOwnerId, dedupeStrategy) =>
      leadsService.bulkImport(rows, pipelineId, defaultStageId, defaultOwnerId, dedupeStrategy),
    exportCsv: () => leadsService.exportCsv(),
  };
}
