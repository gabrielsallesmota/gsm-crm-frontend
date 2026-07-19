import type { DashboardRepository } from "../DashboardRepository";
import type { DashboardMetrics } from "../../types/dashboard";
import { delay } from "../../utils/errors";
import { computeDashboardMetrics } from "../../mock/dashboard";
import { mockState } from "./state";

export class DashboardMockRepository implements DashboardRepository {
  async getMetrics(): Promise<DashboardMetrics> {
    await delay(250);
    const leads = mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId);
    return computeDashboardMetrics(leads);
  }
}
