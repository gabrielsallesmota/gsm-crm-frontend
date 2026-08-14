import type { DashboardRepository } from "../repositories/DashboardRepository";
import { DashboardApiRepository } from "../repositories/api/DashboardApiRepository";
import { DashboardMockRepository } from "../repositories/mock/DashboardMockRepository";
import { selectRepository } from "./factory";
import type { DashboardMetrics } from "../types/dashboard";

const repo: DashboardRepository = selectRepository(
  () => new DashboardMockRepository(),
  () => new DashboardApiRepository(),
);

export class DashboardService {
  getMetrics(): Promise<DashboardMetrics> {
    return repo.getMetrics();
  }
}

export const dashboardService = new DashboardService();
