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
  /** Data em que o negócio foi fechado — por padrão é "hoje" na criação,
   * mas EDITÁVEL de propósito (`UpdateClientInput.closedAt`): cadastro
   * retroativo de cliente antigo precisa registrar a data real do
   * fechamento, não a data em que foi digitado no sistema. */
  closedAt: string;
  /** `null` até a primeira geração de parcelas (`generateInstallments`/
   * `createCustomInstallmentPlan`). */
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
  closedAt?: string;
}

export interface GenerateInstallmentsInput {
  paymentType: PaymentType;
  totalValueCents: number;
  /** Ignorado pelo backend quando `paymentType === "vista"` (força 1). */
  installmentCount: number;
  firstDueDate: string;
}

export interface CustomInstallmentItemInput {
  dueDate: string;
  amountCents: number;
}

/** Alternativa a `GenerateInstallmentsInput` pra plano de pagamento
 * IRREGULAR — cada parcela com seu próprio valor/vencimento (ex.: entrada
 * maior + parcelas menores depois), em vez da divisão igual automática.
 * Pedido explícito do usuário: "realmente precisa ter opção de parcela
 * dinâmica". */
export interface CustomInstallmentPlanInput {
  paymentType: PaymentType;
  installments: CustomInstallmentItemInput[];
}

export interface UpdateInstallmentInput {
  dueDate?: string;
  amountCents?: number;
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
