import type { ClientsRepository } from "../repositories/ClientsRepository";
import { ClientsApiRepository } from "../repositories/api/ClientsApiRepository";
import { ClientsMockRepository } from "../repositories/mock/ClientsMockRepository";
import { selectRepository } from "./factory";
import type {
  Client,
  ClientContract,
  ClientInstallment,
  ClientListFilter,
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
import type { Page } from "../types/common";

const repo: ClientsRepository = selectRepository(
  () => new ClientsMockRepository(),
  () => new ClientsApiRepository(),
);

export class ClientsService {
  create(input: CreateClientInput): Promise<Client> {
    return repo.create(input);
  }

  list(filter: ClientListFilter): Promise<Page<Client>> {
    return repo.list(filter);
  }

  get(id: string): Promise<Client> {
    return repo.get(id);
  }

  update(id: string, input: UpdateClientInput): Promise<Client> {
    return repo.update(id, input);
  }

  delete(id: string): Promise<void> {
    return repo.delete(id);
  }

  createFromLead(input: CreateClientFromLeadInput): Promise<CreateClientFromLeadResult> {
    return repo.createFromLead(input);
  }

  findByLead(leadId: string): Promise<Client | null> {
    return repo.findByLead(leadId);
  }

  listContracts(clientId: string): Promise<ClientContract[]> {
    return repo.listContracts(clientId);
  }

  createContract(clientId: string, input: CreateContractInput): Promise<ClientContract> {
    return repo.createContract(clientId, input);
  }

  updateContract(
    clientId: string,
    contractId: string,
    input: UpdateContractInput,
  ): Promise<ClientContract> {
    return repo.updateContract(clientId, contractId, input);
  }

  endContract(clientId: string, contractId: string): Promise<ClientContract> {
    return repo.endContract(clientId, contractId);
  }

  deleteContract(clientId: string, contractId: string): Promise<void> {
    return repo.deleteContract(clientId, contractId);
  }

  listInstallments(clientId: string, contractId?: string): Promise<ClientInstallment[]> {
    return repo.listInstallments(clientId, contractId);
  }

  generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
    contractId?: string,
  ): Promise<ClientInstallment[]> {
    return repo.generateInstallments(clientId, input, contractId);
  }

  createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
    contractId?: string,
  ): Promise<ClientInstallment[]> {
    return repo.createCustomInstallmentPlan(clientId, input, contractId);
  }

  updateInstallment(
    clientId: string,
    installmentId: string,
    input: UpdateInstallmentInput,
  ): Promise<ClientInstallment> {
    return repo.updateInstallment(clientId, installmentId, input);
  }

  markInstallmentPaid(
    clientId: string,
    installmentId: string,
    paidAt?: string | null,
  ): Promise<ClientInstallment> {
    return repo.markInstallmentPaid(clientId, installmentId, paidAt);
  }

  markInstallmentUnpaid(clientId: string, installmentId: string): Promise<ClientInstallment> {
    return repo.markInstallmentUnpaid(clientId, installmentId);
  }

  uploadContractFile(clientId: string, file: File): Promise<Client> {
    return repo.uploadContractFile(clientId, file);
  }

  downloadContractFile(clientId: string): Promise<Blob> {
    return repo.downloadContractFile(clientId);
  }

  deleteContractFile(clientId: string): Promise<Client> {
    return repo.deleteContractFile(clientId);
  }
}

export const clientsService = new ClientsService();
