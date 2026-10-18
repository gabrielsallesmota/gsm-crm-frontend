/** Cliente = negócio fechado do tenant. Nasce ao confirmar o diálogo "Criar cliente?" quando
 * um Lead vai pra uma etapa de ganho (`source: "lead"`); na GSM, Prospect/Lead ganho também
 * cria sozinho (`source` vira "prospect"/"lead"). Também pode ser
 * cadastrado manualmente (`source: "manual"`, botão "+ Novo cliente" em
 * `ClientsPage`) pra contrato fechado direto, sem passar por Prospecção/
 * Leads. */
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
  /** Responsável pelo cliente — recebe as tarefas de renovação. */
  ownerId: string | null;
  /** Calculados pelo backend a partir das parcelas — nunca editados direto. */
  nextDueDate: string | null;
  hasOverdueInstallment: boolean;
  /** Contratos ATIVOS e a menor data de renovação entre eles (calculados no backend). */
  contractsCount: number;
  nextRenewalDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Como o alerta de renovação é calculado a partir da data de renovação. */
export type RenewalAlertMode = "month_start" | "days_before" | "months_before";

export type ContractStatus = "active" | "renewed" | "ended";

/** Um contrato/ciclo do cliente (Cliente > Contratos > Parcelas). */
export interface ClientContract {
  id: string;
  clientId: string;
  title: string;
  valueCents: number | null;
  paymentType: PaymentType | null;
  installmentCount: number | null;
  startDate: string;
  endDate: string | null;
  renewalDate: string | null;
  /** `null` = usa o padrão do tenant (Automações → Renovação de contrato). */
  renewalAlertMode: RenewalAlertMode | null;
  renewalAlertValue: number | null;
  status: ContractStatus;
  cycleNumber: number;
  previousContractId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractInput {
  startDate: string;
  title?: string;
  valueCents?: number;
  paymentType?: PaymentType;
  endDate?: string;
  renewalDate?: string;
  renewalAlertMode?: RenewalAlertMode;
  renewalAlertValue?: number;
  notes?: string;
}

/** Campos omitidos não mudam. `clear*` limpam; `resetAlert` volta ao padrão do tenant. */
export interface UpdateContractInput {
  title?: string;
  valueCents?: number;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  renewalAlertMode?: RenewalAlertMode;
  renewalAlertValue?: number;
  notes?: string;
  clearRenewalDate?: boolean;
  clearEndDate?: boolean;
  resetAlert?: boolean;
}

/** Conversão confirmada no diálogo "Criar cliente?" ao ganhar um lead. */
export interface CreateClientFromLeadInput {
  leadId: string;
  closedAt?: string;
  contract?: CreateContractInput;
}

export interface CreateClientFromLeadResult {
  client: Client;
  /** `false` = o lead já tinha virado cliente antes (idempotente). */
  created: boolean;
}

export interface ClientInstallment {
  id: string;
  clientId: string;
  contractId: string | null;
  sequence: number;
  dueDate: string;
  amountCents: number;
  paidAt: string | null;
  status: InstallmentStatus;
}

export interface ClientListFilter {
  search?: string;
  paymentType?: PaymentType;
  ownerId?: string;
  /** Renovação entre as duas datas (inclusive), só contratos ativos. */
  renewalFrom?: string;
  renewalTo?: string;
  hasOverdue?: boolean;
  page?: number;
  pageSize?: number;
}

/** Cadastro manual — botão "+ Novo cliente" (`ClientsPage`). `closedAt`
 * omitido = hoje (mesmo default do backend). Payment/parcelas não entram
 * aqui de propósito: depois de criado, a pessoa continua direto no
 * `ClientDrawer` (que já abre sozinho) pra anexar contrato e definir o
 * pagamento — mesmo fluxo em duas etapas de "criar" → "editar" que
 * `LeadsPage`/`QuickCreateModal` já usa. */
export interface CreateClientInput {
  companyName: string;
  phone?: string;
  email?: string;
  city?: string;
  niche?: string;
  notes?: string;
  closedAt?: string;
  ownerId?: string;
}

export interface UpdateClientInput {
  companyName?: string;
  phone?: string;
  email?: string;
  city?: string;
  niche?: string;
  notes?: string;
  closedAt?: string;
  ownerId?: string;
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

export const RENEWAL_ALERT_MODE_LABEL: Record<RenewalAlertMode, string> = {
  month_start: "No 1º dia do mês da renovação",
  days_before: "Dias antes da renovação",
  months_before: "Meses antes da renovação",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  active: "Ativo",
  renewed: "Renovado",
  ended: "Encerrado",
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
