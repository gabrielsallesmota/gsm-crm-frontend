import type { ClientsRepository } from "../ClientsRepository";
import type {
  Client,
  ClientContract,
  ClientInstallment,
  ClientListFilter,
  ClientSource,
  ContractStatus,
  CreateClientFromLeadInput,
  CreateClientFromLeadResult,
  CreateClientInput,
  CreateContractInput,
  CustomInstallmentPlanInput,
  GenerateInstallmentsInput,
  InstallmentStatus,
  PaymentType,
  RenewalAlertMode,
  UpdateClientInput,
  UpdateContractInput,
  UpdateInstallmentInput,
} from "../../types/client";
import type { Page } from "../../types/common";
import { apiRequest, apiRequestBlob } from "./ApiClient";

interface ClientDto {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  niche: string | null;
  source: ClientSource;
  source_id: string | null;
  closed_at: string;
  payment_type: PaymentType | null;
  total_value_cents: number | null;
  installment_count: number | null;
  contract_file_name: string | null;
  contract_uploaded_at: string | null;
  notes: string | null;
  owner_id?: string | null;
  next_due_date: string | null;
  has_overdue_installment: boolean;
  contracts_count?: number;
  next_renewal_date?: string | null;
  created_at: string;
  updated_at: string;
}

interface ContractDto {
  id: string;
  client_id: string;
  title: string | null;
  value_cents: number | null;
  payment_type: PaymentType | null;
  installment_count: number | null;
  start_date: string;
  end_date: string | null;
  renewal_date: string | null;
  renewal_alert_mode: RenewalAlertMode | null;
  renewal_alert_value: number | null;
  status: ContractStatus;
  cycle_number: number;
  previous_contract_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InstallmentDto {
  id: string;
  client_id: string;
  contract_id?: string | null;
  sequence: number;
  due_date: string;
  amount_cents: number;
  paid_at: string | null;
  status: InstallmentStatus;
}

function toClient(dto: ClientDto): Client {
  return {
    id: dto.id,
    companyName: dto.company_name,
    phone: dto.phone ?? "",
    email: dto.email ?? "",
    city: dto.city ?? "",
    niche: dto.niche ?? "",
    source: dto.source,
    sourceId: dto.source_id,
    // `?? ""` (não `dto.closed_at` cru): campo novo no backend — numa
    // janela de deploy com a API ainda desatualizada (frontend/backend em
    // pipelines de deploy independentes, sem coordenação), a chave nem
    // vem no JSON. `fmtDate` já trata "" como "—" em vez de estourar.
    closedAt: dto.closed_at ?? "",
    paymentType: dto.payment_type,
    totalValueCents: dto.total_value_cents,
    installmentCount: dto.installment_count,
    contractFileName: dto.contract_file_name,
    contractUploadedAt: dto.contract_uploaded_at,
    notes: dto.notes ?? "",
    ownerId: dto.owner_id ?? null,
    nextDueDate: dto.next_due_date,
    hasOverdueInstallment: dto.has_overdue_installment,
    contractsCount: dto.contracts_count ?? 0,
    nextRenewalDate: dto.next_renewal_date ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toInstallment(dto: InstallmentDto): ClientInstallment {
  return {
    id: dto.id,
    clientId: dto.client_id,
    contractId: dto.contract_id ?? null,
    sequence: dto.sequence,
    dueDate: dto.due_date,
    amountCents: dto.amount_cents,
    paidAt: dto.paid_at,
    status: dto.status,
  };
}

function toContract(dto: ContractDto): ClientContract {
  return {
    id: dto.id,
    clientId: dto.client_id,
    title: dto.title ?? "",
    valueCents: dto.value_cents,
    paymentType: dto.payment_type,
    installmentCount: dto.installment_count,
    startDate: dto.start_date,
    endDate: dto.end_date,
    renewalDate: dto.renewal_date,
    renewalAlertMode: dto.renewal_alert_mode,
    renewalAlertValue: dto.renewal_alert_value,
    status: dto.status,
    cycleNumber: dto.cycle_number,
    previousContractId: dto.previous_contract_id,
    notes: dto.notes ?? "",
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function contractFields(input: UpdateContractInput) {
  return {
    start_date: input.startDate,
    title: input.title,
    value_cents: input.valueCents,
    end_date: input.endDate,
    renewal_date: input.renewalDate,
    renewal_alert_mode: input.renewalAlertMode,
    renewal_alert_value: input.renewalAlertValue,
    notes: input.notes,
  };
}

function createContractBody(input: CreateContractInput) {
  return { ...contractFields(input), payment_type: input.paymentType };
}

function withContract(path: string, contractId?: string): string {
  return contractId ? `${path}?contract_id=${encodeURIComponent(contractId)}` : path;
}

function updateBody(input: UpdateClientInput) {
  return {
    company_name: input.companyName,
    phone: input.phone,
    email: input.email,
    city: input.city,
    niche: input.niche,
    notes: input.notes,
    closed_at: input.closedAt,
    owner_id: input.ownerId,
  };
}

export class ClientsApiRepository implements ClientsRepository {
  async create(input: CreateClientInput): Promise<Client> {
    return toClient(
      await apiRequest<ClientDto>("/api/v1/clients", {
        method: "POST",
        body: JSON.stringify({
          company_name: input.companyName,
          phone: input.phone,
          email: input.email,
          city: input.city,
          niche: input.niche,
          notes: input.notes,
          closed_at: input.closedAt,
          owner_id: input.ownerId,
        }),
      }),
    );
  }

  async list(filter: ClientListFilter): Promise<Page<Client>> {
    const params = new URLSearchParams();
    if (filter.search) params.set("search", filter.search);
    if (filter.paymentType) params.set("payment_type", filter.paymentType);
    if (filter.ownerId) params.set("owner_id", filter.ownerId);
    if (filter.renewalFrom) params.set("renewal_from", filter.renewalFrom);
    if (filter.renewalTo) params.set("renewal_to", filter.renewalTo);
    if (filter.hasOverdue !== undefined) params.set("has_overdue", String(filter.hasOverdue));
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 100));

    const dto = await apiRequest<{ items: ClientDto[]; total: number; page: number; page_size: number }>(
      `/api/v1/clients?${params.toString()}`,
    );
    return { items: dto.items.map(toClient), total: dto.total, page: dto.page, pageSize: dto.page_size };
  }

  async get(id: string): Promise<Client> {
    return toClient(await apiRequest<ClientDto>(`/api/v1/clients/${id}`));
  }

  async update(id: string, input: UpdateClientInput): Promise<Client> {
    return toClient(
      await apiRequest<ClientDto>(`/api/v1/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updateBody(input)),
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/clients/${id}`, { method: "DELETE" });
  }

  async createFromLead(input: CreateClientFromLeadInput): Promise<CreateClientFromLeadResult> {
    const dto = await apiRequest<{ client: ClientDto; created: boolean }>(
      "/api/v1/clients/from-lead",
      {
        method: "POST",
        body: JSON.stringify({
          lead_id: input.leadId,
          closed_at: input.closedAt,
          contract: input.contract ? createContractBody(input.contract) : undefined,
        }),
      },
    );
    return { client: toClient(dto.client), created: dto.created };
  }

  async findByLead(leadId: string): Promise<Client | null> {
    const dto = await apiRequest<ClientDto | null>(`/api/v1/clients/by-lead/${leadId}`);
    return dto ? toClient(dto) : null;
  }

  async listContracts(clientId: string): Promise<ClientContract[]> {
    const dto = await apiRequest<ContractDto[]>(`/api/v1/clients/${clientId}/contracts`);
    return dto.map(toContract);
  }

  async createContract(clientId: string, input: CreateContractInput): Promise<ClientContract> {
    return toContract(
      await apiRequest<ContractDto>(`/api/v1/clients/${clientId}/contracts`, {
        method: "POST",
        body: JSON.stringify(createContractBody(input)),
      }),
    );
  }

  async updateContract(
    clientId: string,
    contractId: string,
    input: UpdateContractInput,
  ): Promise<ClientContract> {
    return toContract(
      await apiRequest<ContractDto>(`/api/v1/clients/${clientId}/contracts/${contractId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...contractFields(input),
          clear_renewal_date: input.clearRenewalDate,
          clear_end_date: input.clearEndDate,
          reset_alert: input.resetAlert,
        }),
      }),
    );
  }

  async endContract(clientId: string, contractId: string): Promise<ClientContract> {
    return toContract(
      await apiRequest<ContractDto>(`/api/v1/clients/${clientId}/contracts/${contractId}/end`, {
        method: "POST",
      }),
    );
  }

  async deleteContract(clientId: string, contractId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/clients/${clientId}/contracts/${contractId}`, {
      method: "DELETE",
    });
  }

  async listInstallments(clientId: string, contractId?: string): Promise<ClientInstallment[]> {
    const dto = await apiRequest<InstallmentDto[]>(
      withContract(`/api/v1/clients/${clientId}/installments`, contractId),
    );
    return dto.map(toInstallment);
  }

  async generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
    contractId?: string,
  ): Promise<ClientInstallment[]> {
    const dto = await apiRequest<InstallmentDto[]>(
      withContract(`/api/v1/clients/${clientId}/installments/generate`, contractId),
      {
        method: "POST",
        body: JSON.stringify({
          payment_type: input.paymentType,
          total_value_cents: input.totalValueCents,
          installment_count: input.installmentCount,
          first_due_date: input.firstDueDate,
        }),
      },
    );
    return dto.map(toInstallment);
  }

  async createCustomInstallmentPlan(
    clientId: string,
    input: CustomInstallmentPlanInput,
    contractId?: string,
  ): Promise<ClientInstallment[]> {
    const dto = await apiRequest<InstallmentDto[]>(
      withContract(`/api/v1/clients/${clientId}/installments/custom`, contractId),
      {
        method: "POST",
        body: JSON.stringify({
          payment_type: input.paymentType,
          installments: input.installments.map((item) => ({
            due_date: item.dueDate,
            amount_cents: item.amountCents,
          })),
        }),
      },
    );
    return dto.map(toInstallment);
  }

  async updateInstallment(
    clientId: string,
    installmentId: string,
    input: UpdateInstallmentInput,
  ): Promise<ClientInstallment> {
    return toInstallment(
      await apiRequest<InstallmentDto>(`/api/v1/clients/${clientId}/installments/${installmentId}`, {
        method: "PUT",
        body: JSON.stringify({ due_date: input.dueDate, amount_cents: input.amountCents }),
      }),
    );
  }

  async markInstallmentPaid(
    clientId: string,
    installmentId: string,
    paidAt?: string | null,
  ): Promise<ClientInstallment> {
    return toInstallment(
      await apiRequest<InstallmentDto>(`/api/v1/clients/${clientId}/installments/${installmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ paid_at: paidAt ?? new Date().toISOString().slice(0, 10) }),
      }),
    );
  }

  async markInstallmentUnpaid(clientId: string, installmentId: string): Promise<ClientInstallment> {
    return toInstallment(
      await apiRequest<InstallmentDto>(`/api/v1/clients/${clientId}/installments/${installmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ paid_at: null }),
      }),
    );
  }

  async uploadContractFile(clientId: string, file: File): Promise<Client> {
    const form = new FormData();
    form.append("file", file);
    return toClient(
      await apiRequest<ClientDto>(`/api/v1/clients/${clientId}/contract`, {
        method: "POST",
        body: form,
      }),
    );
  }

  async downloadContractFile(clientId: string): Promise<Blob> {
    return apiRequestBlob(`/api/v1/clients/${clientId}/contract`);
  }

  async deleteContractFile(clientId: string): Promise<Client> {
    return toClient(
      await apiRequest<ClientDto>(`/api/v1/clients/${clientId}/contract`, { method: "DELETE" }),
    );
  }
}
