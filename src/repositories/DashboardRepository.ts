import type { DashboardMetrics } from "../types/dashboard";

export interface DashboardRepository {
  getMetrics(): Promise<DashboardMetrics>;
}
