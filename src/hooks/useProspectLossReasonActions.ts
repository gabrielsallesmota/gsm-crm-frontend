import { prospectsService } from "../services/ProspectsService";
import type {
  CreateProspectLossReasonInput,
  ProspectLossReason,
  UpdateProspectLossReasonInput,
} from "../types/prospect";

export interface ProspectLossReasonActions {
  create(input: CreateProspectLossReasonInput): Promise<ProspectLossReason>;
  update(id: string, input: UpdateProspectLossReasonInput): Promise<ProspectLossReason>;
  delete(id: string): Promise<void>;
}

export function useProspectLossReasonActions(): ProspectLossReasonActions {
  return {
    create: (input) => prospectsService.createLossReason(input),
    update: (id, input) => prospectsService.updateLossReason(id, input),
    delete: (id) => prospectsService.deleteLossReason(id),
  };
}
