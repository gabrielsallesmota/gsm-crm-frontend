import { spacesService } from "../services/SpacesService";
import type { SpaceAdmin } from "../types/operations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSpaces(): AsyncResourceState<SpaceAdmin[]> {
  return useAsyncResource(() => spacesService.list(), []);
}
