import { operationsApiRepository } from "../repositories/api/OperationsApiRepository";
import type { OperationsClient } from "../types/operations";

export class OperationsClientsService {
  list(search?: string): Promise<OperationsClient[]> {
    return operationsApiRepository.listClients(search);
  }

  create(name: string, phone: string): Promise<OperationsClient> {
    return operationsApiRepository.createClient(name, phone);
  }
}

export const operationsClientsService = new OperationsClientsService();
