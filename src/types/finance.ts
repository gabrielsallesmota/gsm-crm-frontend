/** Financeiro interno da GSM (PF × PJ). Área INTERNA: só platform staff, nunca de cliente.
 * Valores sempre em centavos. */
export type EntryKind = "income" | "expense";
export type FinScope = "pf" | "pj";
export type CategoryScope = FinScope | "both";
export type EntryStatus = "paid" | "pending" | "overdue";
export type AccountKind = "conta" | "cartao" | "dinheiro" | "investimento";

/** Perfil financeiro (PF, PJ ou outro): dono de contas, categorias e lançamentos. */
export interface FinProfile {
  id: string;
  name: string;
  kind: FinScope;
  archived: boolean;
}

export interface CreateProfileInput {
  name: string;
  kind: FinScope;
}

export interface FinCategory {
  id: string;
  profileId: string;
  name: string;
  kind: EntryKind;
  scope: CategoryScope;
  color: string;
  monthlyBudgetCents: number | null;
  archived: boolean;
}

export interface FinAccount {
  id: string;
  profileId: string;
  name: string;
  scope: FinScope;
  kind: AccountKind;
  archived: boolean;
  /** Só cartão de crédito. */
  closingDay: number | null;
  dueDay: number | null;
  creditLimitCents: number | null;
  institution: string | null;
  /** Só cartão: conta que paga a fatura por padrão. */
  payerAccountId: string | null;
  initialBalanceCents: number;
  initialBalanceDate: string | null;
  lastReconciledOn: string | null;
  lastReconciledBalanceCents: number | null;
  /** Só na listagem de contas (cartão não tem saldo): o já efetivado até hoje e o previsto. */
  balanceCents: number | null;
  projectedCents: number | null;
}

export interface CreateAccountInput {
  name: string;
  profileId: string;
  institution?: string;
  initialBalanceCents?: number;
  initialBalanceDate?: string | null;
  payerAccountId?: string;
  kind: AccountKind;
  closingDay?: number;
  dueDay?: number;
  creditLimitCents?: number | null;
}

export interface UpdateAccountInput {
  name?: string;
  institution?: string | null;
  initialBalanceCents?: number;
  initialBalanceDate?: string | null;
  payerAccountId?: string | null;
  archived?: boolean;
  closingDay?: number;
  dueDay?: number;
  creditLimitCents?: number | null;
}

/** open = recebendo compras · closed = fechada, a pagar · overdue = venceu sem pagar · paid · empty */
export type InvoiceStatus = "open" | "closed" | "partial" | "overdue" | "paid" | "empty";

export interface InvoiceSummary {
  /** "AAAA-MM" do mês em que a fatura fecha. */
  ref: string;
  periodStart: string;
  closingDate: string;
  dueDate: string;
  total: number;
  paidTotal: number;
  /** O que ainda falta pagar (compras − estornos − pagamentos). */
  remaining: number;
  count: number;
  unpaidCount: number;
  paidOn: string | null;
  status: InvoiceStatus;
}

export interface CardOverview {
  account: FinAccount;
  usedCents: number;
  availableCents: number | null;
  current: InvoiceSummary;
  next: InvoiceSummary;
}

export interface InvoicePayment {
  id: string;
  payerAccountId: string | null;
  amountCents: number;
  paidOn: string;
  /** Pagamento anterior à V2 (sem conta pagadora): não mexe em saldo de conta. */
  legacy: boolean;
}

export interface PayInvoiceInput {
  /** Omitida = a conta pagadora padrão do cartão. */
  payerAccountId?: string;
  /** Omitido = tudo o que falta. */
  amountCents?: number;
  paidAt?: string;
}

export interface InvoiceDetail {
  card: FinAccount;
  invoice: InvoiceSummary;
  entries: FinEntry[];
  payments: InvoicePayment[];
  byCategory: { name: string; color: string; total: number; count: number }[];
}

export interface FinEntry {
  id: string;
  profileId: string;
  kind: EntryKind;
  scope: FinScope;
  categoryId: string | null;
  accountId: string | null;
  amountCents: number;
  description: string;
  entryDate: string;
  dueDate: string | null;
  paidAt: string | null;
  paymentMethod: string;
  notes: string;
  recurrenceId: string | null;
  installmentNo: number | null;
  installmentTotal: number | null;
  /** Recorrência sem fim (o servidor mantém 12 meses à frente). */
  isFixed: boolean;
  tags: string[];
  /** Cartão: fatura (AAAA-MM) gravada na compra. */
  invoiceRef: string | null;
  /** Estorno de compra no cartão: crédito na fatura (nunca receita). */
  isRefund: boolean;
  /** Baixa efetiva (já aconteceu) × agendada (data futura); sem baixa = null. */
  paymentState: "effective" | "scheduled" | null;
  status: EntryStatus;
  /** Só após editar com `apply` ≠ "this": quantos itens da série mudaram. */
  affected?: number;
}

/** Em quais itens de uma série a edição vale. */
export type ApplyScope = "this" | "future" | "all";

export interface EntryFilter {
  /** Sem perfil = consolidado. */
  profileId?: string;
  scope?: FinScope;
  kind?: EntryKind;
  categoryId?: string;
  accountId?: string;
  tag?: string;
  status?: EntryStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateEntryInput {
  kind: EntryKind;
  profileId: string;
  amountCents: number;
  description: string;
  entryDate: string;
  categoryId?: string | null;
  accountId?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  paymentMethod?: string;
  notes?: string;
  /** 1 = único; N = série mensal de N meses (mesmo valor). */
  repeatMonths?: number;
  /** Todo mês, sem data final (ignora `repeatMonths`). */
  fixed?: boolean;
  tags?: string[];
}

/** Só o que for informado muda; `null` limpa categoria, conta, vencimento e baixa. */
export type UpdateEntryInput = Partial<
  Omit<CreateEntryInput, "repeatMonths">
>;

export interface CreateCategoryInput {
  name: string;
  kind: EntryKind;
  profileId: string;
  color: string;
  monthlyBudgetCents?: number | null;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  monthlyBudgetCents?: number | null;
  archived?: boolean;
}

export type TransferKind =
  | "common"
  | "pro_labore"
  | "profit_distribution"
  | "capital_contribution"
  | "reimbursement";

export interface FinTransfer {
  id: string;
  kind: TransferKind;
  fromAccountId: string;
  fromProfileId: string;
  toAccountId: string;
  toProfileId: string;
  amountCents: number;
  transferDate: string;
  description: string;
  notes: string | null;
  rowVersion: number;
}

export interface CreateTransferInput {
  kind: TransferKind;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  transferDate: string;
  description: string;
  notes?: string;
}

export interface ReconcileResult {
  systemCents: number;
  statementCents: number;
  differenceCents: number;
  reconciled: boolean;
  adjustmentCents: number | null;
}

export interface BalanceHistoryItem {
  month: string;
  netCents: number;
  balanceCents: number;
}

export const TRANSFER_KIND_LABEL: Record<TransferKind, string> = {
  common: "Transferência",
  pro_labore: "Pró-labore (PJ → PF)",
  profit_distribution: "Distribuição de lucros (PJ → PF)",
  capital_contribution: "Aporte (PF → PJ)",
  reimbursement: "Reembolso",
};

export interface Totals {
  income: number;
  expense: number;
  result: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  name: string;
  color: string;
  total: number;
  count: number;
  budgetCents: number | null;
  /** 0–∞ (1 = 100% do orçamento); `null` sem orçamento. */
  budgetUsed: number | null;
}

export interface PendingBucket {
  total: number;
  count: number;
}

export interface UpcomingItem {
  id: string;
  description: string;
  kind: EntryKind;
  scope: FinScope;
  amountCents: number;
  dueDate: string;
  overdue: boolean;
  category: string;
}

export interface FinanceDashboard {
  month: string;
  scope: "all" | FinScope;
  kpis: {
    income: number;
    expense: number;
    result: number;
    incomePaid: number;
    incomePending: number;
    expensePaid: number;
    expensePending: number;
    savingsRate: number | null;
    previous: Totals;
  };
  byScope: Record<FinScope, Totals>;
  series: ({ month: string } & Totals)[];
  categories: { expense: CategoryBreakdown[]; income: CategoryBreakdown[] };
  pending: {
    payableOverdue: PendingBucket;
    payableSoon: PendingBucket;
    receivableOverdue: PendingBucket;
    receivableSoon: PendingBucket;
    upcoming: UpcomingItem[];
  };
  topExpenses: {
    id: string;
    description: string;
    scope: FinScope;
    amountCents: number;
    entryDate: string;
    category: string;
  }[];
  daily: { date: string; income: number; expense: number }[];
}

export const SCOPE_LABEL: Record<FinScope, string> = { pf: "Pessoa física", pj: "Pessoa jurídica" };
export const SCOPE_SHORT: Record<FinScope, string> = { pf: "PF", pj: "PJ" };
export const CATEGORY_SCOPE_LABEL: Record<CategoryScope, string> = {
  pf: "Só PF",
  pj: "Só PJ",
  both: "PF e PJ",
};
export const KIND_LABEL: Record<EntryKind, string> = { income: "Receita", expense: "Despesa" };
export const STATUS_LABEL: Record<EntryStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Aberta",
  closed: "Fechada",
  partial: "Paga em parte",
  overdue: "Atrasada",
  paid: "Paga",
  empty: "Sem compras",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  conta: "Conta",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  investimento: "Investimento",
};
