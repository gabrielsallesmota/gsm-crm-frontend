import type { DashboardRepository } from "../repositories/DashboardRepository";
import { DashboardApiRepository } from "../repositories/api/DashboardApiRepository";
import { DashboardMockRepository } from "../repositories/mock/DashboardMockRepository";
import { selectRepository } from "./factory";
import type { DashboardMetrics } from "../types/dashboard";
import type { Period } from "../utils/periods";

const repo: DashboardRepository = selectRepository(
  () => new DashboardMockRepository(),
  () => new DashboardApiRepository(),
);

export class DashboardService {
  getMetrics(period?: Period): Promise<DashboardMetrics> {
    return repo.getMetrics(period);
  }
}

export const dashboardService = new DashboardService();
