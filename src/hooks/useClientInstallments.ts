import { clientsService } from "../services/ClientsService";
import type { ClientInstallment } from "../types/client";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Parcelas de UM contrato (ou, sem `contractId`, de todos os contratos do cliente). */
export function useClientInstallments(
  clientId: string,
  contractId?: string,
): AsyncResourceState<ClientInstallment[]> {
  return useAsyncResource(
    () => clientsService.listInstallments(clientId, contractId),
    [clientId, contractId],
  );
}
