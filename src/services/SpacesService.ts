import { operationsApiRepository } from "../repositories/api/OperationsApiRepository";
import type { CreateSpaceInput, SpaceAdmin, UpdateSpaceInput } from "../types/operations";

export class SpacesService {
  list(onlyActive = false): Promise<SpaceAdmin[]> {
    return operationsApiRepository.listSpaces(onlyActive);
  }

  create(input: CreateSpaceInput): Promise<SpaceAdmin> {
    return operationsApiRepository.createSpace(input);
  }

  update(id: string, input: UpdateSpaceInput): Promise<SpaceAdmin> {
    return operationsApiRepository.updateSpace(id, input);
  }

  delete(id: string): Promise<void> {
    return operationsApiRepository.deleteSpace(id);
  }
}

export const spacesService = new SpacesService();
