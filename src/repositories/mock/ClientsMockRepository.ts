import type { ClientsRepository } from "../ClientsRepository";
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
} from "../../types/client";
import type { Page } from "../../types/common";
import { NotImplementedError } from "../../utils/errors";

const REASON =
  "Clientes (contratos, parcelas e renovações) exige o servidor — não faz parte da demonstração pública do CRM.";

/** Feature real no backend, mas sempre "indisponível" no modo Demo (sem dado real para mostrar). */
export class ClientsMockRepository implements ClientsRepository {
  async create(_input: CreateClientInput): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }

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

  async createFromLead(_input: CreateClientFromLeadInput): Promise<CreateClientFromLeadResult> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async findByLead(_leadId: string): Promise<Client | null> {
    return null;
  }

  async listContracts(_clientId: string): Promise<ClientContract[]> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async createContract(_clientId: string, _input: CreateContractInput): Promise<ClientContract> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async updateContract(
    _clientId: string,
    _contractId: string,
    _input: UpdateContractInput,
  ): Promise<ClientContract> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async endContract(_clientId: string, _contractId: string): Promise<ClientContract> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async deleteContract(_clientId: string, _contractId: string): Promise<void> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async listInstallments(_clientId: string, _contractId?: string): Promise<ClientInstallment[]> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async generateInstallments(
    _clientId: string,
    _input: GenerateInstallmentsInput,
    _contractId?: string,
  ): Promise<ClientInstallment[]> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async createCustomInstallmentPlan(
    _clientId: string,
    _input: CustomInstallmentPlanInput,
    _contractId?: string,
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

  async uploadContractFile(_clientId: string, _file: File): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async downloadContractFile(_clientId: string): Promise<Blob> {
    throw new NotImplementedError("Clientes", REASON);
  }

  async deleteContractFile(_clientId: string): Promise<Client> {
    throw new NotImplementedError("Clientes", REASON);
  }
}
