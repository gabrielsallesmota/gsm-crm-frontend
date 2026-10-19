/** Relatórios financeiros (somente leitura). Valores em centavos; `month` = "AAAA-MM". */

export interface CashFlowRow {
  month: string;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
}

export interface AccrualRow {
  month: string;
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
}

export interface StatementRow {
  date: string;
  type: "entry" | "transfer_in" | "transfer_out" | "adjustment" | "invoice_payment";
  description: string;
  amountCents: number;
  balanceCents: number;
}

export interface StatementReport {
  openingCents: number;
  closingCents: number;
  rows: StatementRow[];
}

export interface CategoryReportRow {
  categoryId: string | null;
  name: string;
  color: string;
  totalCents: number;
  count: number;
  share: number | null;
}

export interface CategoryReport {
  totalCents: number;
  rows: CategoryReportRow[];
}

export interface NetWorthReport {
  series: { month: string; liquidCents: number }[];
  liquidCents: number;
  cardDebtCents: number;
  netPositionCents: number;
}

export interface OpenInvoiceRow {
  cardName: string;
  ref: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
}

export interface FutureInvoicesReport {
  totalCents: number;
  byDueMonth: { month: string; remainingCents: number }[];
  invoices: OpenInvoiceRow[];
}

export interface DueItem {
  kind: "expense" | "income" | "invoice";
  description: string;
  dueDate: string;
  amountCents: number;
}

export interface DueBucket {
  totalCents: number;
  count: number;
  items: DueItem[];
}

export interface DueGroup {
  totalCents: number;
  overdue: DueBucket;
  next7Days: DueBucket;
  next30Days: DueBucket;
  later: DueBucket;
}

export interface PayablesReceivablesReport {
  payable: DueGroup;
  receivable: DueGroup;
}

export interface BudgetVsActualMonth {
  month: string;
  budgetCents: number;
  spentCents: number;
  spentInBudgetedCents: number;
  overBudget: string[];
}

export interface TransfersReport {
  totalCents: number;
  rows: {
    kind: string;
    fromProfile: string;
    toProfile: string;
    totalCents: number;
    count: number;
  }[];
}

export interface PjReport {
  managerial: boolean;
  disclaimer: string;
  incomeCents: number;
  taxProvisionBps: number | null;
  taxProvisionCents: number;
  netRevenueCents: number;
  costs: { fixed: number; variable: number; unclassified: number };
  totalCostsCents: number;
  proLaboreCents: number;
  operatingResultCents: number;
  margin: number | null;
  profitDistributionCents: number;
  byClient: { name: string | null; incomeCents: number; expenseCents: number; resultCents: number }[];
  byProject: { name: string | null; incomeCents: number; expenseCents: number; resultCents: number }[];
}

export interface OverviewProfile {
  profileId: string;
  name: string;
  kind: "pf" | "pj";
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  liquidCents: number;
  cardDebtCents: number;
}

export interface FinanceOverview {
  consolidated: boolean;
  profiles: OverviewProfile[];
  positions: { liquidCents: number; cardDebtCents: number; netCents: number };
}

export interface PeriodState {
  profileId: string;
  month: string;
  closed: boolean;
  closedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
}

export type ReportKind =
  | "cash-flow"
  | "accrual"
  | "statement"
  | "by-category"
  | "net-worth"
  | "budget-vs-actual"
  | "future-invoices"
  | "payables-receivables"
  | "transfers"
  | "pj-management";

export const REPORT_LABEL: Record<ReportKind, string> = {
  "cash-flow": "Fluxo de caixa (regime de caixa)",
  accrual: "Resultado por competência",
  statement: "Extrato da conta",
  "by-category": "Por categoria",
  "net-worth": "Evolução patrimonial",
  "budget-vs-actual": "Orçamento × realizado",
  "future-invoices": "Faturas de cartão a pagar",
  "payables-receivables": "A pagar e a receber",
  transfers: "Transferências entre perfis",
  "pj-management": "Resultado gerencial PJ",
};
