import { therapistsService } from "../services/TherapistsService";
import type { Therapist } from "../types/operations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useTherapists(): AsyncResourceState<Therapist[]> {
  return useAsyncResource(() => therapistsService.list(), []);
}
