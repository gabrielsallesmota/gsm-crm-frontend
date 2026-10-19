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
  FinTransfer,
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
} from "../../types/finance";
import { apiRequest, apiRequestBlob } from "./ApiClient";

interface ProfileDto {
  id: string;
  name: string;
  kind: FinScope;
  archived: boolean;
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
});

const toProfile = (d: ProfileDto): FinProfile => ({
  id: d.id,
  name: d.name,
  kind: d.kind,
  archived: d.archived,
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
  };
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

  async updateProfile(id: string, input: { name?: string; archived?: boolean }): Promise<FinProfile> {
    return toProfile(
      await apiRequest<ProfileDto>(`/api/v1/finance/profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
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
        fixed: input.fixed === true,
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
