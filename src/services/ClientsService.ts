import type { ClientsRepository } from "../repositories/ClientsRepository";
import { ClientsApiRepository } from "../repositories/api/ClientsApiRepository";
import { ClientsMockRepository } from "../repositories/mock/ClientsMockRepository";
import { selectRepository } from "./factory";
import type {
  Client,
  ClientInstallment,
  ClientListFilter,
  CustomInstallmentPlanInput,
  GenerateInstallmentsInput,
  UpdateClientInput,
  UpdateInstallmentInput,
} from "../types/client";
import type { Page } from "../types/common";

const repo: ClientsRepository = selectRepository(
  () => new ClientsMockRepository(),
  () => new ClientsApiRepository(),
);

export class ClientsService {
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

  listInstallments(clientId: string): Promise<ClientInstallment[]> {
    return repo.listInstallments(clientId);
  }

  generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
  ): Promise<ClientInstallment[]> {
    return repo.generateInstallments(clientId, input);
  }

  createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
  ): Promise<ClientInstallment[]> {
    return repo.createCustomInstallmentPlan(clientId, input);
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

  uploadContract(clientId: string, file: File): Promise<Client> {
    return repo.uploadContract(clientId, file);
  }

  downloadContract(clientId: string): Promise<Blob> {
    return repo.downloadContract(clientId);
  }

  deleteContract(clientId: string): Promise<Client> {
    return repo.deleteContract(clientId);
  }
}

export const clientsService = new ClientsService();
