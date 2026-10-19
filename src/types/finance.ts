/** Financeiro interno da GSM (PF × PJ). Área INTERNA: só platform staff, nunca de cliente.
 * Valores sempre em centavos. */
export type EntryKind = "income" | "expense";
export type FinScope = "pf" | "pj";
export type CategoryScope = FinScope | "both";
export type EntryStatus = "paid" | "pending" | "overdue";
export type AccountKind = "conta" | "cartao" | "dinheiro" | "investimento";

export interface FinCategory {
  id: string;
  name: string;
  kind: EntryKind;
  scope: CategoryScope;
  color: string;
  monthlyBudgetCents: number | null;
  archived: boolean;
}

export interface FinAccount {
  id: string;
  name: string;
  scope: FinScope;
  kind: AccountKind;
  archived: boolean;
  /** Só cartão de crédito. */
  closingDay: number | null;
  dueDay: number | null;
  creditLimitCents: number | null;
}

export interface CreateAccountInput {
  name: string;
  scope: FinScope;
  kind: AccountKind;
  closingDay?: number;
  dueDay?: number;
  creditLimitCents?: number | null;
}

export interface UpdateAccountInput {
  name?: string;
  archived?: boolean;
  closingDay?: number;
  dueDay?: number;
  creditLimitCents?: number | null;
}

/** open = recebendo compras · closed = fechada, a pagar · overdue = venceu sem pagar · paid · empty */
export type InvoiceStatus = "open" | "closed" | "overdue" | "paid" | "empty";

export interface InvoiceSummary {
  /** "AAAA-MM" do mês em que a fatura fecha. */
  ref: string;
  periodStart: string;
  closingDate: string;
  dueDate: string;
  total: number;
  paidTotal: number;
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

export interface InvoiceDetail {
  card: FinAccount;
  invoice: InvoiceSummary;
  entries: FinEntry[];
  byCategory: { name: string; color: string; total: number; count: number }[];
}

export interface FinEntry {
  id: string;
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
  status: EntryStatus;
}

export interface EntryFilter {
  scope?: FinScope;
  kind?: EntryKind;
  categoryId?: string;
  accountId?: string;
  status?: EntryStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateEntryInput {
  kind: EntryKind;
  scope: FinScope;
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
}

/** Só o que for informado muda; `null` limpa categoria, conta, vencimento e baixa. */
export type UpdateEntryInput = Partial<
  Omit<CreateEntryInput, "repeatMonths">
>;

export interface CreateCategoryInput {
  name: string;
  kind: EntryKind;
  scope: CategoryScope;
  color: string;
  monthlyBudgetCents?: number | null;
}

export interface UpdateCategoryInput {
  name?: string;
  scope?: CategoryScope;
  color?: string;
  monthlyBudgetCents?: number | null;
  archived?: boolean;
}

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
