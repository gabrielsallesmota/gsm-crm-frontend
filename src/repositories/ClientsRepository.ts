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

export interface ClientsRepository {
  list(filter: ClientListFilter): Promise<Page<Client>>;
  get(id: string): Promise<Client>;
  /** Cadastro manual — botão "+ Novo cliente" (`source` vira "manual").
   * O caminho normal continua sendo automático (Ganho de um Prospect/Lead). */
  create(input: CreateClientInput): Promise<Client>;
  update(id: string, input: UpdateClientInput): Promise<Client>;
  delete(id: string): Promise<void>;

  /** Conversão confirmada no diálogo "Criar cliente?" (idempotente por lead). */
  createFromLead(input: CreateClientFromLeadInput): Promise<CreateClientFromLeadResult>;
  /** "Este lead já virou cliente?" — `null` quando ainda não. */
  findByLead(leadId: string): Promise<Client | null>;

  listContracts(clientId: string): Promise<ClientContract[]>;
  createContract(clientId: string, input: CreateContractInput): Promise<ClientContract>;
  updateContract(
    clientId: string,
    contractId: string,
    input: UpdateContractInput,
  ): Promise<ClientContract>;
  /** Encerra (não renovado) preservando histórico e parcelas. */
  endContract(clientId: string, contractId: string): Promise<ClientContract>;
  /** Recusado pelo backend se há parcela paga — nesse caso, encerre. */
  deleteContract(clientId: string, contractId: string): Promise<void>;

  /** Sem `contractId` = todas as parcelas do cliente. */
  listInstallments(clientId: string, contractId?: string): Promise<ClientInstallment[]>;
  generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
    contractId?: string,
  ): Promise<ClientInstallment[]>;
  /** Plano IRREGULAR — alternativa a `generateInstallments` (ver
   * `CustomInstallmentPlanInput`). */
  createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
    contractId?: string,
  ): Promise<ClientInstallment[]>;
  /** Edita valor e/ou vencimento de UMA parcela específica — recusado
   * pelo backend se ela já estiver paga. */
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

  /** Arquivo PDF do contrato assinado (um por cliente). */
  uploadContractFile(clientId: string, file: File): Promise<Client>;
  /** Nome sugerido pro download vem de `Client.contractFileName` — o blob
   * em si não carrega isso (backend só devolve os bytes + content-type). */
  downloadContractFile(clientId: string): Promise<Blob>;
  deleteContractFile(clientId: string): Promise<Client>;
}
