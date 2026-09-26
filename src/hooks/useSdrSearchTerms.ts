import { sdrService } from "../services/SdrService";
import type { SdrSearchTermCatalog } from "../types/sdr";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Termos aceitos pelo provider da campanha — a MESMA tradução que o
 * backend usa pra validar e o worker usa pra buscar (nunca uma lista
 * paralela no front). Recarrega ao trocar de provider. */
export function useSdrSearchTerms(provider: string): AsyncResourceState<SdrSearchTermCatalog> {
  return useAsyncResource(() => sdrService.listSearchTerms(provider), [provider]);
}
