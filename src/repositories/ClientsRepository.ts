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

export interface ClientsRepository {
  list(filter: ClientListFilter): Promise<Page<Client>>;
  get(id: string): Promise<Client>;
  update(id: string, input: UpdateClientInput): Promise<Client>;
  delete(id: string): Promise<void>;

  listInstallments(clientId: string): Promise<ClientInstallment[]>;
  generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
  ): Promise<ClientInstallment[]>;
  /** Plano IRREGULAR — alternativa a `generateInstallments` (ver
   * `CustomInstallmentPlanInput`). */
  createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
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

  uploadContract(clientId: string, file: File): Promise<Client>;
  /** Nome sugerido pro download vem de `Client.contractFileName` — o blob
   * em si não carrega isso (backend só devolve os bytes + content-type). */
  downloadContract(clientId: string): Promise<Blob>;
  deleteContract(clientId: string): Promise<Client>;
}
