import { sdrService } from "../services/SdrService";
import type { CreateSdrIcpPresetInput, SdrIcpPreset, UpdateSdrIcpPresetInput } from "../types/sdr";

export interface SdrIcpPresetActions {
  create(input: CreateSdrIcpPresetInput): Promise<SdrIcpPreset>;
  update(id: string, input: UpdateSdrIcpPresetInput): Promise<SdrIcpPreset>;
  delete(id: string): Promise<void>;
}

export function useSdrIcpPresetActions(): SdrIcpPresetActions {
  return {
    create: (input) => sdrService.createIcpPreset(input),
    update: (id, input) => sdrService.updateIcpPreset(id, input),
    delete: (id) => sdrService.deleteIcpPreset(id),
  };
}
