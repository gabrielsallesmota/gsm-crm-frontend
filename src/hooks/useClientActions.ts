import { clientsService } from "../services/ClientsService";
import type {
  Client,
  ClientInstallment,
  CustomInstallmentPlanInput,
  GenerateInstallmentsInput,
  UpdateClientInput,
  UpdateInstallmentInput,
} from "../types/client";

export interface ClientActions {
  update(id: string, input: UpdateClientInput): Promise<Client>;
  delete(id: string): Promise<void>;
  generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
  ): Promise<ClientInstallment[]>;
  createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
  ): Promise<ClientInstallment[]>;
  updateInstallment(
    clientId: string,
    installmentId: string,
    input: UpdateInstallmentInput,
  ): Promise<ClientInstallment>;
  markInstallmentPaid(
    clientId: string,
    installmentId: string,
    paidAt?: string | null,
  ): Promise<ClientInstallment>;
  markInstallmentUnpaid(clientId: string, installmentId: string): Promise<ClientInstallment>;
  uploadContract(clientId: string, file: File): Promise<Client>;
  downloadContract(clientId: string): Promise<Blob>;
  deleteContract(clientId: string): Promise<Client>;
}

/** Mesma regra de camadas de `useProspectActions`: só o hook fala com
 * `clientsService`, componentes/páginas só chamam o hook. */
export function useClientActions(): ClientActions {
  return {
    update: (id, input) => clientsService.update(id, input),
    delete: (id) => clientsService.delete(id),
    generateInstallments: (clientId, input) => clientsService.generateInstallments(clientId, input),
    createCustomInstallmentPlan: (clientId, input) =>
      clientsService.createCustomInstallmentPlan(clientId, input),
    updateInstallment: (clientId, installmentId, input) =>
      clientsService.updateInstallment(clientId, installmentId, input),
    markInstallmentPaid: (clientId, installmentId, paidAt) =>
      clientsService.markInstallmentPaid(clientId, installmentId, paidAt),
    markInstallmentUnpaid: (clientId, installmentId) =>
      clientsService.markInstallmentUnpaid(clientId, installmentId),
    uploadContract: (clientId, file) => clientsService.uploadContract(clientId, file),
    downloadContract: (clientId) => clientsService.downloadContract(clientId),
    deleteContract: (clientId) => clientsService.deleteContract(clientId),
  };
}
