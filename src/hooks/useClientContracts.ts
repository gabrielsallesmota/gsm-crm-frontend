import { clientsService } from "../services/ClientsService";
import type { ClientContract } from "../types/client";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useClientContracts(clientId: string): AsyncResourceState<ClientContract[]> {
  return useAsyncResource(() => clientsService.listContracts(clientId), [clientId]);
}
