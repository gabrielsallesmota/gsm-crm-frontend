import type { ClientsRepository } from "../ClientsRepository";
import type {
  Client,
  ClientInstallment,
  ClientListFilter,
  CustomInstallmentPlanInput,
  GenerateInstallmentsInput,
  UpdateClientInput,
  UpdateInstallmentInput,
} from "../../types/client";
import type { Page } from "../../types/common";
import { NotImplementedError } from "../../utils/errors";

const REASON =
  "Clientes é a carteira de contratos fechados da própria GSM Automação — não faz parte da demonstração pública do CRM (mesmo racional de `ProspectsMockRepository`).";

/** Ver `ProspectsMockRepository` — mesmo padrão: feature real no backend,
 * mas sempre "indisponível" no modo Demo (dado comercial interno da GSM). */
export class ClientsMockRepository implements ClientsRepository {
  async list(_filter: ClientListFilter): Promise<Page<Client>> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async get(_id: string): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async update(_id: string, _input: UpdateClientInput): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async delete(_id: string): Promise<void> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async listInstallments(_clientId: string): Promise<ClientInstallment[]> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async generateInstallments(
    _clientId: string,
    _input: GenerateInstallmentsInput,
  ): Promise<ClientInstallment[]> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async createCustomInstallmentPlan(
    _clientId: string,
    _input: CustomInstallmentPlanInput,
  ): Promise<ClientInstallment[]> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async updateInstallment(
    _clientId: string,
    _installmentId: string,
    _input: UpdateInstallmentInput,
  ): Promise<ClientInstallment> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async markInstallmentPaid(
    _clientId: string,
    _installmentId: string,
    _paidAt?: string | null,
  ): Promise<ClientInstallment> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async markInstallmentUnpaid(_clientId: string, _installmentId: string): Promise<ClientInstallment> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async uploadContract(_clientId: string, _file: File): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async downloadContract(_clientId: string): Promise<Blob> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async deleteContract(_clientId: string): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }
}
