import { prospectsService } from "../services/ProspectsService";
import type {
  CreateProspectInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  Prospect,
  ProspectDuplicateCheck,
  UpdateProspectInput,
} from "../types/prospect";

export interface ProspectActions {
  create(input: CreateProspectInput): Promise<Prospect>;
  update(id: string, input: UpdateProspectInput): Promise<Prospect>;
  move(id: string, stageId: string): Promise<Prospect>;
  delete(id: string): Promise<void>;
  checkDuplicate(phone: string): Promise<ProspectDuplicateCheck>;
  bulkImport(
    rows: ImportRowInput[],
    defaultStageId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary>;
  exportCsv(): Promise<string>;
}

/** Mesma regra de camadas de `useLeadActions`: só o hook fala com
 * `prospectsService`, componentes/páginas só chamam o hook. */
export function useProspectActions(): ProspectActions {
  return {
    create: (input) => prospectsService.create(input),
    update: (id, input) => prospectsService.update(id, input),
    move: (id, stageId) => prospectsService.move(id, stageId),
    delete: (id) => prospectsService.delete(id),
    checkDuplicate: (phone) => prospectsService.checkDuplicate(phone),
    bulkImport: (rows, defaultStageId, dedupeStrategy) =>
      prospectsService.bulkImport(rows, defaultStageId, dedupeStrategy),
    exportCsv: () => prospectsService.exportCsv(),
  };
}
