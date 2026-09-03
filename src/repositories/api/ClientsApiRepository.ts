import type { ClientsRepository } from "../ClientsRepository";
import type {
  Client,
  ClientInstallment,
  ClientListFilter,
  ClientSource,
  CustomInstallmentPlanInput,
  GenerateInstallmentsInput,
  InstallmentStatus,
  PaymentType,
  UpdateClientInput,
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
  next_due_date: string | null;
  has_overdue_installment: boolean;
  created_at: string;
  updated_at: string;
}

interface InstallmentDto {
  id: string;
  client_id: string;
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
    nextDueDate: dto.next_due_date,
    hasOverdueInstallment: dto.has_overdue_installment,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toInstallment(dto: InstallmentDto): ClientInstallment {
  return {
    id: dto.id,
    clientId: dto.client_id,
    sequence: dto.sequence,
    dueDate: dto.due_date,
    amountCents: dto.amount_cents,
    paidAt: dto.paid_at,
    status: dto.status,
  };
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
  };
}

export class ClientsApiRepository implements ClientsRepository {
  async list(filter: ClientListFilter): Promise<Page<Client>> {
    const params = new URLSearchParams();
    if (filter.search) params.set("search", filter.search);
    if (filter.paymentType) params.set("payment_type", filter.paymentType);
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

  async listInstallments(clientId: string): Promise<ClientInstallment[]> {
    const dto = await apiRequest<InstallmentDto[]>(`/api/v1/clients/${clientId}/installments`);
    return dto.map(toInstallment);
  }

  async generateInstallments(
    clientId: string,
    input: GenerateInstallmentsInput,
  ): Promise<ClientInstallment[]> {
    const dto = await apiRequest<InstallmentDto[]>(
      `/api/v1/clients/${clientId}/installments/generate`,
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
  ): Promise<ClientInstallment[]> {
    const dto = await apiRequest<InstallmentDto[]>(`/api/v1/clients/${clientId}/installments/custom`, {
      method: "POST",
      body: JSON.stringify({
        payment_type: input.paymentType,
        installments: input.installments.map((item) => ({
          due_date: item.dueDate,
          amount_cents: item.amountCents,
        })),
      }),
    });
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

  async uploadContract(clientId: string, file: File): Promise<Client> {
    const form = new FormData();
    form.append("file", file);
    return toClient(
      await apiRequest<ClientDto>(`/api/v1/clients/${clientId}/contract`, {
        method: "POST",
        body: form,
      }),
    );
  }

  async downloadContract(clientId: string): Promise<Blob> {
    return apiRequestBlob(`/api/v1/clients/${clientId}/contract`);
  }

  async deleteContract(clientId: string): Promise<Client> {
    return toClient(
      await apiRequest<ClientDto>(`/api/v1/clients/${clientId}/contract`, { method: "DELETE" }),
    );
  }
}
