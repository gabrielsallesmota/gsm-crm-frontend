import { leadsService } from "../services/LeadsService";
import type { Lead } from "../types/lead";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";
import { useDebouncedValue } from "./useDebouncedValue";

/** Autocomplete de lead (tarefa/compromisso): busca no BACKEND com debounce,
 * no máximo 8 resultados — substitui o antigo `<select>` com os 200
 * primeiros leads (quem tinha mais que isso não achava o lead). O vendedor
 * só encontra os próprios leads (escopo aplicado no servidor). */
export function useLeadSearch(term: string): AsyncResourceState<Lead[]> {
  const { currentTenantId } = useAuth();
  const debounced = useDebouncedValue(term.trim(), 300);
  return useAsyncResource(
    async () =>
      debounced.length < 2
        ? []
        : (await leadsService.list({ search: debounced, page: 1, pageSize: 8 })).items,
    [debounced, currentTenantId],
  );
}
