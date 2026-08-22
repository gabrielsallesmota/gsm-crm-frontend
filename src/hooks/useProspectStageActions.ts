import { prospectsService } from "../services/ProspectsService";
import type {
  CreateProspectStageInput,
  ProspectStage,
  UpdateProspectStageInput,
} from "../types/prospect";

export interface ProspectStageActions {
  create(input: CreateProspectStageInput): Promise<ProspectStage>;
  update(id: string, input: UpdateProspectStageInput): Promise<ProspectStage>;
  delete(id: string): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
}

export function useProspectStageActions(): ProspectStageActions {
  return {
    create: (input) => prospectsService.createStage(input),
    update: (id, input) => prospectsService.updateStage(id, input),
    delete: (id) => prospectsService.deleteStage(id),
    reorder: (orderedIds) => prospectsService.reorderStages(orderedIds),
  };
}
