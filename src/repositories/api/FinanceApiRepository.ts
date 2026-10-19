import type { FinanceRepository } from "../FinanceRepository";
import type { Page } from "../../types/common";
import type {
  ApplyScope,
  CardOverview,
  CategoryBreakdown,
  CategoryScope,
  CreateAccountInput,
  CreateCategoryInput,
  CreateProfileInput,
  CreateTransferInput,
  BalanceHistoryItem,
  BudgetLine,
  CreateGoalInput,
  FinGoal,
  FinRecurrence,
  Frequency,
  GoalKind,
  RecurrenceMode,
  FinTransfer,
  ImportCommitResult,
  ImportFile,
  ImportHistoryItem,
  ImportPreview,
  ImportRow,
  InvoicePayment,
  PayInvoiceInput,
  ReconcileResult,
  TransferKind,
  FinProfile,
  CreateEntryInput,
  EntryFilter,
  EntryKind,
  EntryStatus,
  FinAccount,
  FinCategory,
  FinEntry,
  FinScope,
  FinanceDashboard,
  InvoiceDetail,
  InvoiceSummary,
  PendingBucket,
  Totals,
  UpcomingItem,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateEntryInput,
  ClientLink,
  ClientLinkSync,
} from "../../types/finance";
import type { FinanceOverview, PeriodState, ReportKind } from "../../types/financeReports";
import { apiRequest, apiRequestBlob } from "./ApiClient";

interface ProfileDto {
  id: string;
  name: string;
  kind: FinScope;
  archived: boolean;
  tax_provision_bps?: number | null;
}

interface RecurrenceDto {
  id: string;
  profile_id: string;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  mode: RecurrenceMode;
  status: "active" | "ended";
  kind: EntryKind;
  description: string;
  amount_cents: number;
  category_id: string | null;
  account_id: string | null;
  next_date: string | null;
  pending_approvals: number;
}

interface BudgetLineDto {
  category_id: string;
  name: string;
  color: string;
  rollover: boolean;
  source: "month" | "default" | "none";
  budget_cents: number | null;
  carry_cents: number;
  available_cents: number | null;
  spent_cents: number;
  remaining_cents: number | null;
  used_ratio: number | null;
}

interface GoalDto {
  id: string;
  profile_id: string;
  name: string;
  kind: GoalKind;
  target_cents: number | null;
  target_months: number | null;
  account_id: string | null;
  deadline: string | null;
  archived: boolean;
  row_version: number;
  saved_cents: number;
  effective_target_cents: number;
  remaining_cents: number;
  progress: number | null;
  average_monthly_expense_cents: number;
  months_covered: number | null;
}

interface CategoryDto {
  id: string;
  profile_id: string;
  name: string;
  kind: EntryKind;
  scope: CategoryScope;
  color: string;
  monthly_budget_cents: number | null;
  archived: boolean;
  budget_rollover?: boolean;
  cost_behavior?: "fixed" | "variable" | null;
}

interface AccountDto {
  id: string;
  profile_id: string;
  name: string;
  scope: FinScope;
  kind: FinAccount["kind"];
  archived: boolean;
  closing_day: number | null;
  due_day: number | null;
  credit_limit_cents: number | null;
  institution?: string | null;
  initial_balance_cents?: number;
  initial_balance_date?: string | null;
  payer_account_id?: string | null;
  last_reconciled_on?: string | null;
  last_reconciled_balance_cents?: number | null;
  balance_cents?: number | null;
  projected_cents?: number | null;
}

interface TransferDto {
  id: string;
  kind: TransferKind;
  from_account_id: string;
  from_profile_id: string;
  to_account_id: string;
  to_profile_id: string;
  amount_cents: number;
  transfer_date: string;
  description: string;
  notes: string | null;
  row_version: number;
}

interface InvoiceDto {
  ref: string;
  period_start: string;
  closing_date: string;
  due_date: string;
  total: number;
  paid_total: number;
  remaining?: number;
  count: number;
  unpaid_count: number;
  paid_on: string | null;
  status: InvoiceSummary["status"];
}

interface EntryDto {
  id: string;
  profile_id: string;
  kind: EntryKind;
  scope: FinScope;
  category_id: string | null;
  account_id: string | null;
  amount_cents: number;
  description: string;
  entry_date: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  recurrence_id: string | null;
  installment_no: number | null;
  installment_total: number | null;
  plan_id?: string | null;
  tags?: string[];
  client?: string | null;
  project?: string | null;
  confirmed?: boolean;
  invoice_ref?: string | null;
  is_refund?: boolean;
  payment_state?: "effective" | "scheduled" | null;
  affected?: number | null;
  status: EntryStatus;
}

interface BucketDto {
  total: number;
  count: number;
}

interface BreakdownDto {
  category_id: string | null;
  name: string;
  color: string;
  total: number;
  count: number;
  budget_cents: number | null;
  budget_used: number | null;
}

interface DashboardDto {
  month: string;
  scope: "all" | FinScope;
  kpis: {
    income: number;
    expense: number;
    result: number;
    income_paid: number;
    income_pending: number;
    expense_paid: number;
    expense_pending: number;
    savings_rate: number | null;
    previous: Totals;
  };
  by_scope: Record<FinScope, Totals>;
  series: ({ month: string } & Totals)[];
  categories: { expense: BreakdownDto[]; income: BreakdownDto[] };
  pending: {
    payable_overdue: BucketDto;
    payable_soon: BucketDto;
    receivable_overdue: BucketDto;
    receivable_soon: BucketDto;
    upcoming: {
      id: string;
      description: string;
      kind: EntryKind;
      scope: FinScope;
      amount_cents: number;
      due_date: string;
      overdue: boolean;
      category: string;
    }[];
  };
  top_expenses: {
    id: string;
    description: string;
    scope: FinScope;
    amount_cents: number;
    entry_date: string;
    category: string;
  }[];
  daily: { date: string; income: number; expense: number }[];
}

const toCategory = (d: CategoryDto): FinCategory => ({
  id: d.id,
  profileId: d.profile_id,
  name: d.name,
  kind: d.kind,
  scope: d.scope,
  color: d.color,
  monthlyBudgetCents: d.monthly_budget_cents,
  archived: d.archived,
  budgetRollover: d.budget_rollover === true,
  costBehavior: d.cost_behavior ?? null,
});

const toProfile = (d: ProfileDto): FinProfile => ({
  id: d.id,
  name: d.name,
  kind: d.kind,
  archived: d.archived,
  taxProvisionBps: d.tax_provision_bps ?? null,
});

const toRecurrence = (d: RecurrenceDto): FinRecurrence => ({
  id: d.id,
  profileId: d.profile_id,
  frequency: d.frequency,
  startDate: d.start_date,
  endDate: d.end_date,
  mode: d.mode,
  status: d.status,
  kind: d.kind,
  description: d.description,
  amountCents: d.amount_cents,
  categoryId: d.category_id,
  accountId: d.account_id,
  nextDate: d.next_date,
  pendingApprovals: d.pending_approvals,
});

const toBudgetLine = (d: BudgetLineDto): BudgetLine => ({
  categoryId: d.category_id,
  name: d.name,
  color: d.color,
  rollover: d.rollover,
  source: d.source,
  budgetCents: d.budget_cents,
  carryCents: d.carry_cents,
  availableCents: d.available_cents,
  spentCents: d.spent_cents,
  remainingCents: d.remaining_cents,
  usedRatio: d.used_ratio,
});

const toGoal = (d: GoalDto): FinGoal => ({
  id: d.id,
  profileId: d.profile_id,
  name: d.name,
  kind: d.kind,
  targetCents: d.target_cents,
  targetMonths: d.target_months,
  accountId: d.account_id,
  deadline: d.deadline,
  archived: d.archived,
  rowVersion: d.row_version,
  savedCents: d.saved_cents,
  effectiveTargetCents: d.effective_target_cents,
  remainingCents: d.remaining_cents,
  progress: d.progress,
  averageMonthlyExpenseCents: d.average_monthly_expense_cents,
  monthsCovered: d.months_covered,
});

const toAccount = (d: AccountDto): FinAccount => ({
  id: d.id,
  profileId: d.profile_id,
  name: d.name,
  scope: d.scope,
  kind: d.kind,
  archived: d.archived,
  closingDay: d.closing_day ?? null,
  dueDay: d.due_day ?? null,
  creditLimitCents: d.credit_limit_cents ?? null,
  institution: d.institution ?? null,
  payerAccountId: d.payer_account_id ?? null,
  initialBalanceCents: d.initial_balance_cents ?? 0,
  initialBalanceDate: d.initial_balance_date ?? null,
  lastReconciledOn: d.last_reconciled_on ?? null,
  lastReconciledBalanceCents: d.last_reconciled_balance_cents ?? null,
  balanceCents: d.balance_cents ?? null,
  projectedCents: d.projected_cents ?? null,
});

const toTransfer = (d: TransferDto): FinTransfer => ({
  id: d.id,
  kind: d.kind,
  fromAccountId: d.from_account_id,
  fromProfileId: d.from_profile_id,
  toAccountId: d.to_account_id,
  toProfileId: d.to_profile_id,
  amountCents: d.amount_cents,
  transferDate: d.transfer_date,
  description: d.description,
  notes: d.notes,
  rowVersion: d.row_version,
});

const toInvoice = (d: InvoiceDto): InvoiceSummary => ({
  ref: d.ref,
  periodStart: d.period_start,
  closingDate: d.closing_date,
  dueDate: d.due_date,
  total: d.total,
  paidTotal: d.paid_total,
  remaining: d.remaining ?? Math.max(d.total - d.paid_total, 0),
  count: d.count,
  unpaidCount: d.unpaid_count,
  paidOn: d.paid_on,
  status: d.status,
});

const toEntry = (d: EntryDto): FinEntry => ({
  id: d.id,
  profileId: d.profile_id,
  kind: d.kind,
  scope: d.scope,
  categoryId: d.category_id,
  accountId: d.account_id,
  amountCents: d.amount_cents,
  description: d.description,
  entryDate: d.entry_date,
  dueDate: d.due_date,
  paidAt: d.paid_at,
  paymentMethod: d.payment_method ?? "",
  notes: d.notes ?? "",
  recurrenceId: d.recurrence_id,
  installmentNo: d.installment_no,
  installmentTotal: d.installment_total,
  isFixed: d.recurrence_id != null,
  tags: d.tags ?? [],
  client: d.client ?? null,
  project: d.project ?? null,
  confirmed: d.confirmed !== false,
  invoiceRef: d.invoice_ref ?? null,
  isRefund: d.is_refund === true,
  paymentState: d.payment_state ?? null,
  status: d.status,
  ...(d.affected != null ? { affected: d.affected } : {}),
});

const toBreakdown = (d: BreakdownDto): CategoryBreakdown => ({
  categoryId: d.category_id,
  name: d.name,
  color: d.color,
  total: d.total,
  count: d.count,
  budgetCents: d.budget_cents,
  budgetUsed: d.budget_used,
});

const toBucket = (d: BucketDto): PendingBucket => ({ total: d.total, count: d.count });

const toUpcoming = (d: DashboardDto["pending"]["upcoming"][number]): UpcomingItem => ({
  id: d.id,
  description: d.description,
  kind: d.kind,
  scope: d.scope,
  amountCents: d.amount_cents,
  dueDate: d.due_date,
  overdue: d.overdue,
  category: d.category,
});

function toDashboard(d: DashboardDto): FinanceDashboard {
  return {
    month: d.month,
    scope: d.scope,
    kpis: {
      income: d.kpis.income,
      expense: d.kpis.expense,
      result: d.kpis.result,
      incomePaid: d.kpis.income_paid,
      incomePending: d.kpis.income_pending,
      expensePaid: d.kpis.expense_paid,
      expensePending: d.kpis.expense_pending,
      savingsRate: d.kpis.savings_rate,
      previous: d.kpis.previous,
    },
    byScope: d.by_scope,
    series: d.series,
    categories: {
      expense: d.categories.expense.map(toBreakdown),
      income: d.categories.income.map(toBreakdown),
    },
    pending: {
      payableOverdue: toBucket(d.pending.payable_overdue),
      payableSoon: toBucket(d.pending.payable_soon),
      receivableOverdue: toBucket(d.pending.receivable_overdue),
      receivableSoon: toBucket(d.pending.receivable_soon),
      upcoming: d.pending.upcoming.map(toUpcoming),
    },
    topExpenses: d.top_expenses.map((t) => ({
      id: t.id,
      description: t.description,
      scope: t.scope,
      amountCents: t.amount_cents,
      entryDate: t.entry_date,
      category: t.category,
    })),
    daily: d.daily,
  };
}

function entryBody(input: CreateEntryInput | UpdateEntryInput) {
  return {
    kind: input.kind,
    profile_id: input.profileId,
    amount_cents: input.amountCents,
    description: input.description,
    entry_date: input.entryDate,
    category_id: input.categoryId,
    account_id: input.accountId,
    due_date: input.dueDate,
    paid_at: input.paidAt,
    payment_method: input.paymentMethod || undefined,
    notes: input.notes,
    tags: input.tags,
    client: input.client,
    project: input.project,
  };
}

/** snake_case → camelCase, recursivamente (as chaves de objetos; valores intactos). */
function camelize<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelize(v)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()),
        camelize(v),
      ]),
    ) as T;
  }
  return value as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const text = q.toString();
  return text ? `?${text}` : "";
}

export class FinanceApiRepository implements FinanceRepository {
  async listProfiles(includeArchived = false): Promise<FinProfile[]> {
    const dto = await apiRequest<ProfileDto[]>(
      `/api/v1/finance/profiles${includeArchived ? "?include_archived=true" : ""}`,
    );
    return dto.map(toProfile);
  }

  async createProfile(input: CreateProfileInput): Promise<FinProfile> {
    return toProfile(
      await apiRequest<ProfileDto>("/api/v1/finance/profiles", {
        method: "POST",
        body: JSON.stringify({ name: input.name, kind: input.kind }),
      }),
    );
  }

  async updateProfile(
    id: string,
    input: { name?: string; archived?: boolean; taxProvisionBps?: number | null },
  ): Promise<FinProfile> {
    return toProfile(
      await apiRequest<ProfileDto>(`/api/v1/finance/profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          archived: input.archived,
          tax_provision_bps: input.taxProvisionBps,
        }),
      }),
    );
  }

  async dashboard(month: string, profileId?: string): Promise<FinanceDashboard> {
    return toDashboard(
      await apiRequest<DashboardDto>(
        `/api/v1/finance/dashboard${query({ month, profile_id: profileId })}`,
      ),
    );
  }

  async listEntries(filter: EntryFilter): Promise<Page<FinEntry>> {
    const dto = await apiRequest<{ items: EntryDto[]; total: number; page: number; page_size: number }>(
      `/api/v1/finance/entries${query({
        profile_id: filter.profileId,
        scope: filter.scope,
        kind: filter.kind,
        category_id: filter.categoryId,
        account_id: filter.accountId,
        tag: filter.tag,
        client: filter.client,
        project: filter.project,
        unconfirmed: filter.unconfirmed ? "true" : undefined,
        status: filter.status,
        date_from: filter.dateFrom,
        date_to: filter.dateTo,
        search: filter.search,
        page: filter.page ?? 1,
        page_size: filter.pageSize ?? 50,
      })}`,
    );
    return { items: dto.items.map(toEntry), total: dto.total, page: dto.page, pageSize: dto.page_size };
  }

  async createEntries(input: CreateEntryInput): Promise<FinEntry[]> {
    const dto = await apiRequest<EntryDto[]>("/api/v1/finance/entries", {
      method: "POST",
      body: JSON.stringify({
        ...entryBody(input),
        repeat_months: input.repeatMonths ?? 1,
        recurrence: input.recurrence
          ? {
              frequency: input.recurrence.frequency,
              end_date: input.recurrence.endDate,
              mode: input.recurrence.mode,
            }
          : undefined,
      }),
    });
    return dto.map(toEntry);
  }

  async updateEntry(id: string, input: UpdateEntryInput, apply: ApplyScope = "this"): Promise<FinEntry> {
    return toEntry(
      await apiRequest<EntryDto>(`/api/v1/finance/entries/${id}${apply === "this" ? "" : `?apply=${apply}`}`, {
        method: "PATCH",
        body: JSON.stringify(entryBody(input)),
      }),
    );
  }

  async payEntry(id: string, paidAt?: string): Promise<FinEntry> {
    return toEntry(
      await apiRequest<EntryDto>(`/api/v1/finance/entries/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ paid_at: paidAt }),
      }),
    );
  }

  async unpayEntry(id: string): Promise<FinEntry> {
    return toEntry(
      await apiRequest<EntryDto>(`/api/v1/finance/entries/${id}/payment`, { method: "DELETE" }),
    );
  }

  async deleteEntry(id: string, series = false): Promise<number> {
    const dto = await apiRequest<{ deleted: number }>(
      `/api/v1/finance/entries/${id}${series ? "?series=true" : ""}`,
      { method: "DELETE" },
    );
    return dto.deleted;
  }

  async reauth(password: string): Promise<string> {
    const dto = await apiRequest<{ token: string }>("/api/v1/finance/reauth", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    return dto.token;
  }

  async exportCsv(
    filter: Pick<EntryFilter, "profileId" | "kind" | "dateFrom" | "dateTo">,
    reauthToken: string,
  ): Promise<Blob> {
    return apiRequestBlob(
      `/api/v1/finance/export.csv${query({
        profile_id: filter.profileId,
        kind: filter.kind,
        date_from: filter.dateFrom,
        date_to: filter.dateTo,
      })}`,
      { headers: { "X-Finance-Reauth": reauthToken } },
    );
  }

  async listCategories(includeArchived = false): Promise<FinCategory[]> {
    const dto = await apiRequest<CategoryDto[]>(
      `/api/v1/finance/categories${includeArchived ? "?include_archived=true" : ""}`,
    );
    return dto.map(toCategory);
  }

  async createCategory(input: CreateCategoryInput): Promise<FinCategory> {
    return toCategory(
      await apiRequest<CategoryDto>("/api/v1/finance/categories", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          kind: input.kind,
          profile_id: input.profileId,
          color: input.color,
          budget_rollover: input.budgetRollover,
          cost_behavior: input.costBehavior,
          monthly_budget_cents: input.monthlyBudgetCents ?? null,
        }),
      }),
    );
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<FinCategory> {
    return toCategory(
      await apiRequest<CategoryDto>(`/api/v1/finance/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          color: input.color,
          budget_rollover: input.budgetRollover,
          cost_behavior: input.costBehavior,
          monthly_budget_cents: input.monthlyBudgetCents,
          archived: input.archived,
        }),
      }),
    );
  }

  async listAccounts(includeArchived = false): Promise<FinAccount[]> {
    const dto = await apiRequest<AccountDto[]>(
      `/api/v1/finance/accounts${includeArchived ? "?include_archived=true" : ""}`,
    );
    return dto.map(toAccount);
  }

  async createAccount(input: CreateAccountInput): Promise<FinAccount> {
    return toAccount(
      await apiRequest<AccountDto>("/api/v1/finance/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          profile_id: input.profileId,
          kind: input.kind,
          institution: input.institution,
          initial_balance_cents: input.initialBalanceCents,
          initial_balance_date: input.initialBalanceDate,
          payer_account_id: input.payerAccountId,
          closing_day: input.closingDay,
          due_day: input.dueDay,
          credit_limit_cents: input.creditLimitCents,
        }),
      }),
    );
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<FinAccount> {
    return toAccount(
      await apiRequest<AccountDto>(`/api/v1/finance/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          archived: input.archived,
          payer_account_id: input.payerAccountId,
          institution: input.institution,
          initial_balance_cents: input.initialBalanceCents,
          initial_balance_date: input.initialBalanceDate,
          closing_day: input.closingDay,
          due_day: input.dueDay,
          credit_limit_cents: input.creditLimitCents,
        }),
      }),
    );
  }

  async accountHistory(accountId: string, months = 12): Promise<BalanceHistoryItem[]> {
    const dto = await apiRequest<{ month: string; net_cents: number; balance_cents: number }[]>(
      `/api/v1/finance/accounts/${accountId}/history${query({ months })}`,
    );
    return dto.map((i) => ({ month: i.month, netCents: i.net_cents, balanceCents: i.balance_cents }));
  }

  async reconcile(
    accountId: string,
    input: { on: string; statementBalanceCents: number; adjust: boolean },
  ): Promise<ReconcileResult> {
    const dto = await apiRequest<{
      system_cents: number;
      statement_cents: number;
      difference_cents: number;
      reconciled: boolean;
      adjustment: { amount_cents: number } | null;
    }>(`/api/v1/finance/accounts/${accountId}/reconcile`, {
      method: "POST",
      body: JSON.stringify({
        on: input.on,
        statement_balance_cents: input.statementBalanceCents,
        adjust: input.adjust,
      }),
    });
    return {
      systemCents: dto.system_cents,
      statementCents: dto.statement_cents,
      differenceCents: dto.difference_cents,
      reconciled: dto.reconciled,
      adjustmentCents: dto.adjustment?.amount_cents ?? null,
    };
  }

  async adjustBalance(
    accountId: string,
    input: { amountCents: number; date: string; reason: string },
  ): Promise<void> {
    await apiRequest(`/api/v1/finance/accounts/${accountId}/adjustments`, {
      method: "POST",
      body: JSON.stringify({
        amount_cents: input.amountCents,
        adjustment_date: input.date,
        reason: input.reason,
      }),
    });
  }

  async listTransfers(filter: { profileId?: string; trash?: boolean } = {}): Promise<FinTransfer[]> {
    const dto = await apiRequest<{ items: TransferDto[] }>(
      `/api/v1/finance/transfers${query({
        profile_id: filter.profileId,
        trash: filter.trash ? "true" : undefined,
        page_size: 100,
      })}`,
    );
    return dto.items.map(toTransfer);
  }

  async createTransfer(input: CreateTransferInput): Promise<FinTransfer> {
    return toTransfer(
      await apiRequest<TransferDto>("/api/v1/finance/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          kind: input.kind,
          from_account_id: input.fromAccountId,
          to_account_id: input.toAccountId,
          amount_cents: input.amountCents,
          transfer_date: input.transferDate,
          description: input.description,
          notes: input.notes,
        }),
      }),
    );
  }

  async deleteTransfer(id: string): Promise<void> {
    await apiRequest(`/api/v1/finance/transfers/${id}`, { method: "DELETE" });
  }

  async restoreTransfer(id: string): Promise<FinTransfer> {
    return toTransfer(
      await apiRequest<TransferDto>(`/api/v1/finance/transfers/${id}/restore`, { method: "POST" }),
    );
  }

  async previewImport(accountId: string, file: ImportFile): Promise<ImportPreview> {
    const dto = await apiRequest<{
      account_id: string;
      source: ImportPreview["source"];
      total: number;
      new: number;
      duplicate: number;
      match: number;
      error: number;
      income_cents: number;
      expense_cents: number;
      ledger_balance_cents: number | null;
      ledger_date: string | null;
      warnings: string[];
      already_imported_at: string | null;
      rows: {
        line: number;
        posted: string | null;
        amount_cents: number | null;
        description: string;
        external_id: string | null;
        status: ImportRow["status"];
        error: string | null;
        match: { entry_id: string; description: string; entry_date: string; amount_cents: number } | null;
        default_decision: "import" | "skip";
      }[];
    }>("/api/v1/finance/imports/preview", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        file_name: file.name,
        content_base64: file.contentBase64,
      }),
    });
    return {
      accountId: dto.account_id,
      source: dto.source,
      total: dto.total,
      new: dto.new,
      duplicate: dto.duplicate,
      match: dto.match,
      error: dto.error,
      incomeCents: dto.income_cents,
      expenseCents: dto.expense_cents,
      ledgerBalanceCents: dto.ledger_balance_cents,
      ledgerDate: dto.ledger_date,
      warnings: dto.warnings,
      alreadyImportedAt: dto.already_imported_at,
      rows: dto.rows.map(
        (r): ImportRow => ({
          line: r.line,
          posted: r.posted,
          amountCents: r.amount_cents,
          description: r.description,
          externalId: r.external_id,
          status: r.status,
          error: r.error,
          match: r.match
            ? {
                entryId: r.match.entry_id,
                description: r.match.description,
                entryDate: r.match.entry_date,
                amountCents: r.match.amount_cents,
              }
            : null,
          defaultDecision: r.default_decision,
        }),
      ),
    };
  }

  async commitImport(
    accountId: string,
    file: ImportFile,
    options: { decisions?: Record<number, string>; defaultCategoryId?: string } = {},
  ): Promise<ImportCommitResult> {
    const dto = await apiRequest<{
      id: string;
      rows_total: number;
      rows_imported: number;
      rows_linked: number;
      rows_skipped: number;
    }>("/api/v1/finance/imports", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        file_name: file.name,
        content_base64: file.contentBase64,
        decisions: options.decisions ?? {},
        default_category_id: options.defaultCategoryId,
      }),
    });
    return {
      id: dto.id,
      rowsTotal: dto.rows_total,
      rowsImported: dto.rows_imported,
      rowsLinked: dto.rows_linked,
      rowsSkipped: dto.rows_skipped,
    };
  }

  async listImports(accountId?: string): Promise<ImportHistoryItem[]> {
    const dto = await apiRequest<
      {
        id: string;
        account_id: string;
        source: string;
        file_name: string;
        status: "committed" | "undone";
        rows_total: number;
        rows_imported: number;
        rows_linked: number;
        rows_skipped: number;
        created_at: string | null;
      }[]
    >(`/api/v1/finance/imports${query({ account_id: accountId })}`);
    return dto.map((i) => ({
      id: i.id,
      accountId: i.account_id,
      source: i.source,
      fileName: i.file_name,
      status: i.status,
      rowsTotal: i.rows_total,
      rowsImported: i.rows_imported,
      rowsLinked: i.rows_linked,
      rowsSkipped: i.rows_skipped,
      createdAt: i.created_at,
    }));
  }

  async undoImport(importId: string): Promise<{ removed: number; restored: number }> {
    return apiRequest<{ removed: number; restored: number }>(
      `/api/v1/finance/imports/${importId}/undo`,
      { method: "POST" },
    );
  }

  async listClientLinks(): Promise<ClientLink[]> {
    return camelize<ClientLink[]>(await apiRequest<unknown>("/api/v1/finance/client-links"));
  }

  async setClientLink(clientId: string, accountId: string): Promise<ClientLinkSync> {
    return camelize<ClientLinkSync>(
      await apiRequest<unknown>(`/api/v1/finance/client-links/${clientId}`, {
        method: "PUT",
        body: JSON.stringify({ account_id: accountId }),
      }),
    );
  }

  async removeClientLink(clientId: string): Promise<number> {
    const body = await apiRequest<{ removed: number }>(`/api/v1/finance/client-links/${clientId}`, {
      method: "DELETE",
    });
    return body.removed;
  }

  async report<T>(
    kind: ReportKind,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    return camelize<T>(await apiRequest<unknown>(`/api/v1/finance/reports/${kind}${query(params)}`));
  }

  async overview(month: string, profileId?: string): Promise<FinanceOverview> {
    return camelize<FinanceOverview>(
      await apiRequest<unknown>(
        `/api/v1/finance/reports/overview${query({ month, profile_id: profileId })}`,
      ),
    );
  }

  async listPeriods(profileId?: string): Promise<PeriodState[]> {
    return camelize<PeriodState[]>(
      await apiRequest<unknown>(`/api/v1/finance/periods${query({ profile_id: profileId })}`),
    );
  }

  async closePeriod(profileId: string, month: string): Promise<void> {
    await apiRequest("/api/v1/finance/periods/close", {
      method: "POST",
      body: JSON.stringify({ profile_id: profileId, month }),
    });
  }

  async reopenPeriod(
    profileId: string,
    month: string,
    reason: string,
    reauthToken: string,
  ): Promise<void> {
    await apiRequest("/api/v1/finance/periods/reopen", {
      method: "POST",
      headers: { "X-Finance-Reauth": reauthToken },
      body: JSON.stringify({ profile_id: profileId, month, reason }),
    });
  }

  async listRecurrences(status?: "active" | "ended"): Promise<FinRecurrence[]> {
    const dto = await apiRequest<RecurrenceDto[]>(`/api/v1/finance/recurrences${query({ status })}`);
    return dto.map(toRecurrence);
  }

  async endRecurrence(id: string): Promise<void> {
    await apiRequest(`/api/v1/finance/recurrences/${id}/end`, { method: "POST", body: "{}" });
  }

  async confirmEntry(entryId: string, confirmed = true): Promise<FinEntry> {
    return toEntry(
      await apiRequest<EntryDto>(`/api/v1/finance/entries/${entryId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmed }),
      }),
    );
  }

  async listBudgets(profileId: string, month: string): Promise<BudgetLine[]> {
    const dto = await apiRequest<BudgetLineDto[]>(
      `/api/v1/finance/budgets${query({ profile_id: profileId, month })}`,
    );
    return dto.map(toBudgetLine);
  }

  async setBudget(categoryId: string, month: string, amountCents: number | null): Promise<void> {
    await apiRequest(`/api/v1/finance/budgets/${categoryId}/${month}`, {
      method: "PUT",
      body: JSON.stringify({ amount_cents: amountCents }),
    });
  }

  async copyBudgets(
    profileId: string,
    fromMonth: string,
    toMonth: string,
    overwrite = false,
  ): Promise<number> {
    const dto = await apiRequest<{ copied: number }>("/api/v1/finance/budgets/copy", {
      method: "POST",
      body: JSON.stringify({
        profile_id: profileId,
        from_month: fromMonth,
        to_month: toMonth,
        overwrite,
      }),
    });
    return dto.copied;
  }

  async listGoals(profileId?: string): Promise<FinGoal[]> {
    const dto = await apiRequest<GoalDto[]>(
      `/api/v1/finance/goals${query({ profile_id: profileId })}`,
    );
    return dto.map(toGoal);
  }

  async createGoal(input: CreateGoalInput): Promise<FinGoal> {
    return toGoal(
      await apiRequest<GoalDto>("/api/v1/finance/goals", {
        method: "POST",
        body: JSON.stringify({
          profile_id: input.profileId,
          name: input.name,
          kind: input.kind,
          target_cents: input.targetCents,
          target_months: input.targetMonths,
          account_id: input.accountId,
          saved_cents: input.savedCents,
          deadline: input.deadline,
        }),
      }),
    );
  }

  async updateGoal(id: string, input: { name?: string; archived?: boolean }): Promise<FinGoal> {
    return toGoal(
      await apiRequest<GoalDto>(`/api/v1/finance/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  }

  async contributeGoal(id: string, deltaCents: number): Promise<FinGoal> {
    return toGoal(
      await apiRequest<GoalDto>(`/api/v1/finance/goals/${id}/contribute`, {
        method: "POST",
        body: JSON.stringify({ delta_cents: deltaCents }),
      }),
    );
  }

  async listTags(profileId?: string): Promise<string[]> {
    return apiRequest<string[]>(`/api/v1/finance/tags${query({ profile_id: profileId })}`);
  }

  async listCards(): Promise<CardOverview[]> {
    const dto = await apiRequest<
      {
        account: AccountDto;
        used_cents: number;
        available_cents: number | null;
        current: InvoiceDto;
        next: InvoiceDto;
      }[]
    >("/api/v1/finance/cards");
    return dto.map((c) => ({
      account: toAccount(c.account),
      usedCents: c.used_cents,
      availableCents: c.available_cents,
      current: toInvoice(c.current),
      next: toInvoice(c.next),
    }));
  }

  async listInvoices(accountId: string): Promise<InvoiceSummary[]> {
    const dto = await apiRequest<InvoiceDto[]>(`/api/v1/finance/cards/${accountId}/invoices`);
    return dto.map(toInvoice);
  }

  async getInvoice(accountId: string, ref: string): Promise<InvoiceDetail> {
    const dto = await apiRequest<{
      card: AccountDto;
      invoice: InvoiceDto;
      entries: EntryDto[];
      payments?: {
        id: string;
        payer_account_id: string | null;
        amount_cents: number;
        paid_on: string;
        legacy?: boolean;
      }[];
      by_category: { name: string; color: string; total: number; count: number }[];
    }>(`/api/v1/finance/cards/${accountId}/invoices/${ref}`);
    return {
      card: toAccount(dto.card),
      invoice: toInvoice(dto.invoice),
      entries: dto.entries.map(toEntry),
      payments: (dto.payments ?? []).map(
        (p): InvoicePayment => ({
          id: p.id,
          payerAccountId: p.payer_account_id,
          amountCents: p.amount_cents,
          paidOn: p.paid_on,
          legacy: p.legacy === true,
        }),
      ),
      byCategory: dto.by_category,
    };
  }

  async payInvoice(
    accountId: string,
    ref: string,
    input: PayInvoiceInput = {},
  ): Promise<InvoiceSummary> {
    const dto = await apiRequest<{ invoice: InvoiceDto }>(
      `/api/v1/finance/cards/${accountId}/invoices/${ref}/payments`,
      {
        method: "POST",
        body: JSON.stringify({
          payer_account_id: input.payerAccountId,
          amount_cents: input.amountCents,
          paid_at: input.paidAt,
        }),
      },
    );
    return toInvoice(dto.invoice);
  }

  async undoInvoicePayment(accountId: string, ref: string, paymentId: string): Promise<InvoiceSummary> {
    const dto = await apiRequest<{ invoice: InvoiceDto }>(
      `/api/v1/finance/cards/${accountId}/invoices/${ref}/payments/${paymentId}`,
      { method: "DELETE" },
    );
    return toInvoice(dto.invoice);
  }

  async refundPurchase(entryId: string, input: { amountCents?: number; date?: string } = {}): Promise<void> {
    await apiRequest(`/api/v1/finance/entries/${entryId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount_cents: input.amountCents, refund_date: input.date }),
    });
  }
}
