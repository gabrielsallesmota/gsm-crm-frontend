/** Cliente = Prospect/Lead que fechou contrato — nasce automaticamente ao
 * mover pra um estágio "Ganho" (ver `maybe_create_client_from_prospect`/
 * `maybe_create_client_from_lead` no backend), nunca é criado manualmente
 * daqui. Tela só edita dados comerciais (contrato, pagamento). */
export type ClientSource = "prospect" | "lead" | "manual";

export type PaymentType = "vista" | "mensal";

export type InstallmentStatus = "pago" | "atrasado" | "pendente";

export interface Client {
  id: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  niche: string;
  source: ClientSource;
  /** Id do Prospect ou Lead que originou este Cliente — `null` quando
   * `source === "manual"`. Sem FK de propósito no backend (pode apontar pra
   * duas tabelas diferentes), aqui só usado pra link/depuração. */
  sourceId: string | null;
  /** `null` até a primeira geração de parcelas (`generateInstallments`). */
  paymentType: PaymentType | null;
  totalValueCents: number | null;
  installmentCount: number | null;
  contractFileName: string | null;
  contractUploadedAt: string | null;
  notes: string;
  /** Calculados pelo backend a partir das parcelas — nunca editados direto. */
  nextDueDate: string | null;
  hasOverdueInstallment: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInstallment {
  id: string;
  clientId: string;
  sequence: number;
  dueDate: string;
  amountCents: number;
  paidAt: string | null;
  status: InstallmentStatus;
}

export interface ClientListFilter {
  search?: string;
  paymentType?: PaymentType;
  page?: number;
  pageSize?: number;
}

export interface UpdateClientInput {
  companyName?: string;
  phone?: string;
  email?: string;
  city?: string;
  niche?: string;
  notes?: string;
}

export interface GenerateInstallmentsInput {
  paymentType: PaymentType;
  totalValueCents: number;
  /** Ignorado pelo backend quando `paymentType === "vista"` (força 1). */
  installmentCount: number;
  firstDueDate: string;
}

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  vista: "À vista",
  mensal: "Mensal",
};

export const CLIENT_SOURCE_LABEL: Record<ClientSource, string> = {
  prospect: "Prospecção",
  lead: "Lead passivo",
  manual: "Manual",
};

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  pago: "Pago",
  atrasado: "Atrasado",
  pendente: "Pendente",
};
