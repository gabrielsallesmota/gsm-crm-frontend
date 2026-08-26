import { therapistsService } from "../services/TherapistsService";
import type { CreateTherapistInput, Therapist, UpdateTherapistInput } from "../types/operations";

export interface TherapistActions {
  create(input: CreateTherapistInput): Promise<Therapist>;
  update(id: string, input: UpdateTherapistInput): Promise<Therapist>;
  delete(id: string): Promise<void>;
}

export function useTherapistActions(): TherapistActions {
  return {
    create: (input) => therapistsService.create(input),
    update: (id, input) => therapistsService.update(id, input),
    delete: (id) => therapistsService.delete(id),
  };
}
