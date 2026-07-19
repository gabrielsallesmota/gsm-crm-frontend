import type { DashboardRepository } from "../DashboardRepository";
import type { DashboardMetrics } from "../../types/dashboard";
import { NotImplementedError } from "../../utils/errors";

export class DashboardApiRepository implements DashboardRepository {
  async getMetrics(): Promise<DashboardMetrics> {
    throw new NotImplementedError("Dashboard");
  }
}
