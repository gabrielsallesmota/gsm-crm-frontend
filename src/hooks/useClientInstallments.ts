import { clientsService } from "../services/ClientsService";
import type { ClientInstallment } from "../types/client";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useClientInstallments(clientId: string): AsyncResourceState<ClientInstallment[]> {
  return useAsyncResource(() => clientsService.listInstallments(clientId), [clientId]);
}
