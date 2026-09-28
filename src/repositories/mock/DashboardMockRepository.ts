import type { DashboardRepository } from "../DashboardRepository";
import type { DashboardMetrics } from "../../types/dashboard";
import type { Period } from "../../utils/periods";
import { delay } from "../../utils/errors";
import { computeDashboardMetrics } from "../../mock/dashboard";
import { mockState } from "./state";

export class DashboardMockRepository implements DashboardRepository {
  async getMetrics(period?: Period, pipelineId?: string): Promise<DashboardMetrics> {
    await delay(250);
    const pipelines = mockState.pipelines.filter((p) => p.tenantId === mockState.currentTenantId);
    const pipeline =
      pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];
    let leads = mockState.leads.filter(
      (l) => l.tenantId === mockState.currentTenantId && l.pipelineId === pipeline?.id,
    );
    if (period?.dateFrom) leads = leads.filter((l) => l.createdAt.slice(0, 10) >= period.dateFrom!);
    if (period?.dateTo) leads = leads.filter((l) => l.createdAt.slice(0, 10) <= period.dateTo!);
    return computeDashboardMetrics(leads, pipeline?.stages ?? []);
  }
}
