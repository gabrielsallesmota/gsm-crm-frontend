import { sdrService } from "../services/SdrService";
import type { CreateSdrDiscardReasonInput, SdrDiscardReason } from "../types/sdr";

export interface SdrDiscardReasonActions {
  create(input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason>;
  update(id: string, input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason>;
  delete(id: string): Promise<void>;
}

export function useSdrDiscardReasonActions(): SdrDiscardReasonActions {
  return {
    create: (input) => sdrService.createDiscardReason(input),
    update: (id, input) => sdrService.updateDiscardReason(id, input),
    delete: (id) => sdrService.deleteDiscardReason(id),
  };
}
