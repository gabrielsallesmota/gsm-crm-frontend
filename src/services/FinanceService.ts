import type { FinanceRepository } from "../repositories/FinanceRepository";
import { FinanceApiRepository } from "../repositories/api/FinanceApiRepository";
import { FinanceMockRepository } from "../repositories/mock/FinanceMockRepository";
import { selectRepository } from "./factory";

export const financeService: FinanceRepository = selectRepository<FinanceRepository>(
  () => new FinanceMockRepository(),
  () => new FinanceApiRepository(),
);
