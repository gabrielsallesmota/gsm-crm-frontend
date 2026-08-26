import { operationsClientsService } from "../services/OperationsClientsService";
import type { OperationsClient } from "../types/operations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useOperationsClients(search: string): AsyncResourceState<OperationsClient[]> {
  return useAsyncResource(() => operationsClientsService.list(search || undefined), [search]);
}
