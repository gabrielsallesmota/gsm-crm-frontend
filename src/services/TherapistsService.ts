import { operationsApiRepository } from "../repositories/api/OperationsApiRepository";
import type { CreateTherapistInput, Therapist, UpdateTherapistInput } from "../types/operations";

export class TherapistsService {
  list(onlyActive = false): Promise<Therapist[]> {
    return operationsApiRepository.listTherapists(onlyActive);
  }

  create(input: CreateTherapistInput): Promise<Therapist> {
    return operationsApiRepository.createTherapist(input);
  }

  update(id: string, input: UpdateTherapistInput): Promise<Therapist> {
    return operationsApiRepository.updateTherapist(id, input);
  }

  delete(id: string): Promise<void> {
    return operationsApiRepository.deleteTherapist(id);
  }
}

export const therapistsService = new TherapistsService();
