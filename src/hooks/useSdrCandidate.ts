import { sdrService } from "../services/SdrService";
import type { SdrCandidate } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrCandidate(id: string): AsyncResourceState<SdrCandidate> {
  return useAsyncResource(() => sdrService.getCandidate(id), [id]);
}
