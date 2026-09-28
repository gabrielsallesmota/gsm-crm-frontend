import { leadsService } from "../services/LeadsService";
import type { Lead } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Um lead pelo id (`GET /leads/{id}`) — abre a ficha por URL mesmo quando o
 * lead não está na página atual da lista. `null` = nada a buscar. */
export function useLead(id: string | undefined): AsyncResourceState<Lead | null> {
  return useAsyncResource(async () => (id ? leadsService.get(id) : null), [id]);
}
