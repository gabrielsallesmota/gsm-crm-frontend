import { financeService } from "../services/FinanceService";
import type { Page } from "../types/common";
import type {
  CardOverview,
  EntryFilter,
  FinAccount,
  FinCategory,
  FinEntry,
  FinScope,
  FinanceDashboard,
  InvoiceDetail,
  InvoiceSummary,
} from "../types/finance";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

export function useFinanceDashboard(
  month: string,
  scope: FinScope | undefined,
): AsyncResourceState<FinanceDashboard> {
  return useAsyncResource(() => financeService.dashboard(month, scope), [month, scope]);
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
