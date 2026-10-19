import type { FinanceRepository } from "../FinanceRepository";
import { NotImplementedError } from "../../utils/errors";

const REASON = "O financeiro é interno da GSM e exige o servidor — não existe no modo demonstração.";

function unavailable(): never {
  throw new NotImplementedError("Financeiro", REASON);
}

/** Área interna: sempre "indisponível" na demonstração pública (mesmo padrão de Prospecção). */
export class FinanceMockRepository implements FinanceRepository {
  listProfiles = async () => unavailable();
  createProfile = async () => unavailable();
  updateProfile = async () => unavailable();
  dashboard = async () => unavailable();
  listEntries = async () => unavailable();
  createEntries = async () => unavailable();
  updateEntry = async () => unavailable();
  payEntry = async () => unavailable();
  unpayEntry = async () => unavailable();
  deleteEntry = async () => unavailable();
  reauth = async () => unavailable();
  exportCsv = async () => unavailable();
  listCategories = async () => unavailable();
  createCategory = async () => unavailable();
  updateCategory = async () => unavailable();
  listAccounts = async () => unavailable();
  accountHistory = async () => unavailable();
  reconcile = async () => unavailable();
  adjustBalance = async () => unavailable();
  listTransfers = async () => unavailable();
  createTransfer = async () => unavailable();
  deleteTransfer = async () => unavailable();
  restoreTransfer = async () => unavailable();
  listTags = async () => unavailable();
  previewImport = async () => unavailable();
  commitImport = async () => unavailable();
  listImports = async () => unavailable();
  undoImport = async () => unavailable();
  listClientLinks = async () => unavailable();
  setClientLink = async () => unavailable();
  removeClientLink = async () => unavailable();
  report = async () => unavailable();
  overview = async () => unavailable();
  listPeriods = async () => unavailable();
  closePeriod = async () => unavailable();
  reopenPeriod = async () => unavailable();
  listRecurrences = async () => unavailable();
  endRecurrence = async () => unavailable();
  confirmEntry = async () => unavailable();
  listBudgets = async () => unavailable();
  setBudget = async () => unavailable();
  copyBudgets = async () => unavailable();
  listGoals = async () => unavailable();
  createGoal = async () => unavailable();
  updateGoal = async () => unavailable();
  contributeGoal = async () => unavailable();
  createAccount = async () => unavailable();
  updateAccount = async () => unavailable();
  listCards = async () => unavailable();
  listInvoices = async () => unavailable();
  getInvoice = async () => unavailable();
  payInvoice = async () => unavailable();
  undoInvoicePayment = async () => unavailable();
  refundPurchase = async () => unavailable();
}
