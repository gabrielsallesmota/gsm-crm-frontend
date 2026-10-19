import type {
  ApplyScope,
  CardOverview,
  CreateAccountInput,
  CreateCategoryInput,
  CreateEntryInput,
  CreateProfileInput,
  CreateTransferInput,
  BalanceHistoryItem,
  FinTransfer,
  ReconcileResult,
  EntryFilter,
  FinAccount,
  FinCategory,
  FinEntry,
  FinanceDashboard,
  FinProfile,
  InvoiceDetail,
  InvoiceSummary,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateEntryInput,
} from "../types/finance";
import type { Page } from "../types/common";

export interface FinanceRepository {
  listProfiles(includeArchived?: boolean): Promise<FinProfile[]>;
  createProfile(input: CreateProfileInput): Promise<FinProfile>;
  updateProfile(id: string, input: { name?: string; archived?: boolean }): Promise<FinProfile>;

  /** Sem `profileId` = consolidado (todos os perfis). */
  dashboard(month: string, profileId?: string): Promise<FinanceDashboard>;

  listEntries(filter: EntryFilter): Promise<Page<FinEntry>>;
  /** Devolve todas as ocorrências criadas (uma só, ou a série mensal). */
  createEntries(input: CreateEntryInput): Promise<FinEntry[]>;
  /** `apply`: só este (padrão), este e os seguintes, ou a série toda (itens não pagos). */
  updateEntry(id: string, input: UpdateEntryInput, apply?: ApplyScope): Promise<FinEntry>;
  /** Baixa (data omitida = hoje). */
  payEntry(id: string, paidAt?: string): Promise<FinEntry>;
  unpayEntry(id: string): Promise<FinEntry>;
  /** `series` apaga também as próximas ocorrências NÃO pagas da recorrência. */
  deleteEntry(id: string, series?: boolean): Promise<number>;
  /** Confere a senha do proprietário e devolve um token curto exigido para exportar dados. */
  reauth(password: string): Promise<string>;
  exportCsv(
    filter: Pick<EntryFilter, "profileId" | "kind" | "dateFrom" | "dateTo">,
    reauthToken: string,
  ): Promise<Blob>;

  listCategories(includeArchived?: boolean): Promise<FinCategory[]>;
  createCategory(input: CreateCategoryInput): Promise<FinCategory>;
  updateCategory(id: string, input: UpdateCategoryInput): Promise<FinCategory>;

  listAccounts(includeArchived?: boolean): Promise<FinAccount[]>;
  accountHistory(accountId: string, months?: number): Promise<BalanceHistoryItem[]>;
  /** Compara o saldo do sistema com o do extrato; com `adjust`, registra a diferença como ajuste. */
  reconcile(
    accountId: string,
    input: { on: string; statementBalanceCents: number; adjust: boolean },
  ): Promise<ReconcileResult>;
  adjustBalance(
    accountId: string,
    input: { amountCents: number; date: string; reason: string },
  ): Promise<void>;

  listTransfers(filter?: { profileId?: string; trash?: boolean }): Promise<FinTransfer[]>;
  createTransfer(input: CreateTransferInput): Promise<FinTransfer>;
  deleteTransfer(id: string): Promise<void>;
  restoreTransfer(id: string): Promise<FinTransfer>;
  listTags(profileId?: string): Promise<string[]>;
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
