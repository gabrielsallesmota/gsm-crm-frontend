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
  move(
    id: string,
    stageId: string,
    targetDate?: string | null,
    lossReasonId?: string | null,
  ): Promise<Prospect>;
  delete(id: string): Promise<void>;
  sendEmail(id: string, subject: string, body: string): Promise<{ sent: boolean }>;
  checkDuplicate(phone: string): Promise<ProspectDuplicateCheck>;
  bulkImport(
    rows: ImportRowInput[],
    defaultStageId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary>;
  exportCsv(): Promise<string>;
  backfillCadence(): Promise<number>;
}

/** Mesma regra de camadas de `useLeadActions`: só o hook fala com
 * `prospectsService`, componentes/páginas só chamam o hook. */
export function useProspectActions(): ProspectActions {
  return {
    create: (input) => prospectsService.create(input),
    update: (id, input) => prospectsService.update(id, input),
    move: (id, stageId, targetDate, lossReasonId) =>
      prospectsService.move(id, stageId, targetDate, lossReasonId),
    delete: (id) => prospectsService.delete(id),
    sendEmail: (id, subject, body) => prospectsService.sendEmail(id, subject, body),
    checkDuplicate: (phone) => prospectsService.checkDuplicate(phone),
    bulkImport: (rows, defaultStageId, dedupeStrategy) =>
      prospectsService.bulkImport(rows, defaultStageId, dedupeStrategy),
    exportCsv: () => prospectsService.exportCsv(),
    backfillCadence: () => prospectsService.backfillCadence(),
  };
}
