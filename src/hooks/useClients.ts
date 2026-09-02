import { clientsService } from "../services/ClientsService";
import type { Client, ClientListFilter } from "../types/client";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import type { Page } from "../types/common";
import { useAuth } from "./useAuth";

export function useClients(filter: ClientListFilter): AsyncResourceState<Page<Client>> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    () => clientsService.list(filter),
    [JSON.stringify(filter), currentTenantId],
  );
}
