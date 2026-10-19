import type {
  CardOverview,
  CreateAccountInput,
  CreateCategoryInput,
  CreateEntryInput,
  EntryFilter,
  FinAccount,
  FinCategory,
  FinEntry,
  FinanceDashboard,
  FinScope,
  InvoiceDetail,
  InvoiceSummary,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateEntryInput,
} from "../types/finance";
import type { Page } from "../types/common";

export interface FinanceRepository {
  dashboard(month: string, scope?: FinScope): Promise<FinanceDashboard>;

  listEntries(filter: EntryFilter): Promise<Page<FinEntry>>;
  /** Devolve todas as ocorrências criadas (uma só, ou a série mensal). */
  createEntries(input: CreateEntryInput): Promise<FinEntry[]>;
  updateEntry(id: string, input: UpdateEntryInput): Promise<FinEntry>;
  /** Baixa (data omitida = hoje). */
  payEntry(id: string, paidAt?: string): Promise<FinEntry>;
  unpayEntry(id: string): Promise<FinEntry>;
  /** `series` apaga também as próximas ocorrências NÃO pagas da recorrência. */
  deleteEntry(id: string, series?: boolean): Promise<number>;
  exportCsv(filter: Pick<EntryFilter, "scope" | "kind" | "dateFrom" | "dateTo">): Promise<Blob>;

  listCategories(includeArchived?: boolean): Promise<FinCategory[]>;
  createCategory(input: CreateCategoryInput): Promise<FinCategory>;
  updateCategory(id: string, input: UpdateCategoryInput): Promise<FinCategory>;

  listAccounts(includeArchived?: boolean): Promise<FinAccount[]>;
  createAccount(input: CreateAccountInput): Promise<FinAccount>;
  updateAccount(id: string, input: UpdateAccountInput): Promise<FinAccount>;

  /** Cartões ativos: limite, comprometido, fatura atual e próxima. */
  listCards(): Promise<CardOverview[]>;
  listInvoices(accountId: string): Promise<InvoiceSummary[]>;
  getInvoice(accountId: string, ref: string): Promise<InvoiceDetail>;
  /** Baixa todos os itens da fatura (data omitida = hoje). Devolve quantos mudaram. */
  payInvoice(accountId: string, ref: string, paidAt?: string): Promise<number>;
  unpayInvoice(accountId: string, ref: string): Promise<number>;
}
