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
  createAccount = async () => unavailable();
  updateAccount = async () => unavailable();
  listCards = async () => unavailable();
  listInvoices = async () => unavailable();
  getInvoice = async () => unavailable();
  payInvoice = async () => unavailable();
  unpayInvoice = async () => unavailable();
}
