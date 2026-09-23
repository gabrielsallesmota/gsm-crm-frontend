import { sdrService } from "../services/SdrService";
import type { SdrProspectSdrContext } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useSdrProspectingQueue(): AsyncResourceState<SdrProspectSdrContext[]> {
  return useAsyncResource(() => sdrService.listProspectingQueue(), []);
}
