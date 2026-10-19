import { financeService } from "../services/FinanceService";
import type { Page } from "../types/common";
import type {
  CardOverview,
  EntryFilter,
  FinAccount,
  FinCategory,
  BudgetLine,
  FinEntry,
  FinGoal,
  FinProfile,
  FinRecurrence,
  FinanceDashboard,
  InvoiceDetail,
  InvoiceSummary,
} from "../types/finance";
import type { FinanceOverview, PeriodState } from "../types/financeReports";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useFinanceRecurrences(): AsyncResourceState<FinRecurrence[]> {
  return useAsyncResource(() => financeService.listRecurrences("active"), []);
}

export function useFinanceBudgets(
  profileId: string | undefined,
  month: string,
): AsyncResourceState<BudgetLine[]> {
  return useAsyncResource(
    () => (profileId ? financeService.listBudgets(profileId, month) : Promise.resolve([])),
    [profileId, month],
  );
}

export function useFinanceGoals(profileId: string | undefined): AsyncResourceState<FinGoal[]> {
  return useAsyncResource(() => financeService.listGoals(profileId), [profileId]);
}

export function useFinanceOverview(
  month: string,
  profileId: string | undefined,
): AsyncResourceState<FinanceOverview> {
  return useAsyncResource(() => financeService.overview(month, profileId), [month, profileId]);
}

export function useFinancePeriods(profileId: string | undefined): AsyncResourceState<PeriodState[]> {
  return useAsyncResource(() => financeService.listPeriods(profileId), [profileId]);
}

export function useFinanceProfiles(): AsyncResourceState<FinProfile[]> {
  return useAsyncResource(() => financeService.listProfiles(true), []);
}

export function useFinanceDashboard(
  month: string,
  profileId: string | undefined,
): AsyncResourceState<FinanceDashboard> {
  return useAsyncResource(() => financeService.dashboard(month, profileId), [month, profileId]);
}

export function useFinanceEntries(filter: EntryFilter): AsyncResourceState<Page<FinEntry>> {
  return useAsyncResource(() => financeService.listEntries(filter), [JSON.stringify(filter)]);
}

export function useFinanceCategories(includeArchived = false): AsyncResourceState<FinCategory[]> {
  return useAsyncResource(() => financeService.listCategories(includeArchived), [includeArchived]);
}

export function useFinanceAccounts(includeArchived = false): AsyncResourceState<FinAccount[]> {
  return useAsyncResource(() => financeService.listAccounts(includeArchived), [includeArchived]);
}

export function useFinanceCards(): AsyncResourceState<CardOverview[]> {
  return useAsyncResource(() => financeService.listCards(), []);
}

export function useInvoices(accountId: string | null): AsyncResourceState<InvoiceSummary[]> {
  return useAsyncResource(
    () => (accountId ? financeService.listInvoices(accountId) : Promise.resolve([])),
    [accountId],
  );
}

export function useInvoice(
  accountId: string | null,
  ref: string | null,
): AsyncResourceState<InvoiceDetail | null> {
  return useAsyncResource(
    () => (accountId && ref ? financeService.getInvoice(accountId, ref) : Promise.resolve(null)),
    [accountId, ref],
  );
}
