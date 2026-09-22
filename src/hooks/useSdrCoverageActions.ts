import { sdrService } from "../services/SdrService";
import type { CreateSdrCoverageInput, SdrCoverage, UpdateSdrCoverageInput } from "../types/sdr";

export interface SdrCoverageActions {
  create(input: CreateSdrCoverageInput): Promise<SdrCoverage>;
  update(id: string, input: UpdateSdrCoverageInput): Promise<SdrCoverage>;
  delete(id: string): Promise<void>;
}

export function useSdrCoverageActions(): SdrCoverageActions {
  return {
    create: (input) => sdrService.createCoverage(input),
    update: (id, input) => sdrService.updateCoverage(id, input),
    delete: (id) => sdrService.deleteCoverage(id),
  };
}
