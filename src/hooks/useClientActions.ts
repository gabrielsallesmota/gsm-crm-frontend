import { clientsService } from "../services/ClientsService";
import type {
  Client,
  ClientContract,
  ClientInstallment,
  CreateClientFromLeadInput,
  CreateClientFromLeadResult,
  CreateClientInput,
  CreateContractInput,
  CustomInstallmentPlanInput,
  GenerateInstallmentsInput,
  UpdateClientInput,
  UpdateContractInput,
  UpdateInstallmentInput,
} from "../types/client";

export interface ClientActions {
  create(input: CreateClientInput): Promise<Client>;
  update(id: string, input: UpdateClientInput): Promise<Client>;
  delete(id: string): Promise<void>;
  createFromLead(input: CreateClientFromLeadInput): Promise<CreateClientFromLeadResult>;
  createContract(clientId: string, input: CreateContractInput): Promise<ClientContract>;
  updateContract(
    clientId: string,
    contractId: string,
    input: UpdateContractInput,
  ): Promise<ClientContract>;
  endContract(clientId: string, contractId: string): Promise<ClientContract>;
  deleteContract(clientId: string, contractId: string): Promise<void>;
  generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
    contractId?: string,
  ): Promise<ClientInstallment[]>;
  createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
    contractId?: string,
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
  uploadContractFile(clientId: string, file: File): Promise<Client>;
  downloadContractFile(clientId: string): Promise<Blob>;
  deleteContractFile(clientId: string): Promise<Client>;
}

/** Mesma regra de camadas de `useProspectActions`: só o hook fala com
 * `clientsService`, componentes/páginas só chamam o hook. */
export function useClientActions(): ClientActions {
  return {
    create: (input) => clientsService.create(input),
    update: (id, input) => clientsService.update(id, input),
    delete: (id) => clientsService.delete(id),
    createFromLead: (input) => clientsService.createFromLead(input),
    createContract: (clientId, input) => clientsService.createContract(clientId, input),
    updateContract: (clientId, contractId, input) =>
      clientsService.updateContract(clientId, contractId, input),
    endContract: (clientId, contractId) => clientsService.endContract(clientId, contractId),
    deleteContract: (clientId, contractId) => clientsService.deleteContract(clientId, contractId),
    generateInstallments: (clientId, input, contractId) =>
      clientsService.generateInstallments(clientId, input, contractId),
    createCustomInstallmentPlan: (clientId, input, contractId) =>
      clientsService.createCustomInstallmentPlan(clientId, input, contractId),
    updateInstallment: (clientId, installmentId, input) =>
      clientsService.updateInstallment(clientId, installmentId, input),
    markInstallmentPaid: (clientId, installmentId, paidAt) =>
      clientsService.markInstallmentPaid(clientId, installmentId, paidAt),
    markInstallmentUnpaid: (clientId, installmentId) =>
      clientsService.markInstallmentUnpaid(clientId, installmentId),
    uploadContractFile: (clientId, file) => clientsService.uploadContractFile(clientId, file),
    downloadContractFile: (clientId) => clientsService.downloadContractFile(clientId),
    deleteContractFile: (clientId) => clientsService.deleteContractFile(clientId),
  };
}
