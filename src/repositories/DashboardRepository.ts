import type { DashboardMetrics } from "../types/dashboard";
import type { Period } from "../utils/periods";

export interface DashboardRepository {
  getMetrics(period?: Period): Promise<DashboardMetrics>;
}
