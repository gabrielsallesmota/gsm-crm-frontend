import { prospectsService } from "../services/ProspectsService";
import type { Prospect, ProspectListFilter } from "../types/prospect";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import type { Page } from "../types/common";
import { useAuth } from "./useAuth";

export function useProspects(filter: ProspectListFilter): AsyncResourceState<Page<Prospect>> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    () => prospectsService.list(filter),
    [JSON.stringify(filter), currentTenantId],
  );
}
