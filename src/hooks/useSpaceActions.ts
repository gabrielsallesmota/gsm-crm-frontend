import { spacesService } from "../services/SpacesService";
import type { CreateSpaceInput, SpaceAdmin, UpdateSpaceInput } from "../types/operations";

export interface SpaceActions {
  create(input: CreateSpaceInput): Promise<SpaceAdmin>;
  update(id: string, input: UpdateSpaceInput): Promise<SpaceAdmin>;
  delete(id: string): Promise<void>;
}

export function useSpaceActions(): SpaceActions {
  return {
    create: (input) => spacesService.create(input),
    update: (id, input) => spacesService.update(id, input),
    delete: (id) => spacesService.delete(id),
  };
}
