import type { DashboardRepository } from "../repositories/DashboardRepository";
import { DashboardApiRepository } from "../repositories/api/DashboardApiRepository";
import { DashboardMockRepository } from "../repositories/mock/DashboardMockRepository";
import { CRM_MODE } from "./factory";
import type { DashboardMetrics } from "../types/dashboard";

const repo: DashboardRepository = CRM_MODE === "demo" ? new DashboardMockRepository() : new DashboardApiRepository();

export class DashboardService {
  getMetrics(): Promise<DashboardMetrics> {
    return repo.getMetrics();
  }
}

export const dashboardService = new DashboardService();
