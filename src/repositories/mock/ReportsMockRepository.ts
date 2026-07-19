import type { ReportsRepository } from "../ReportsRepository";
import type { ReportCard } from "../../types/report";
import { delay } from "../../utils/errors";
import { computeReportCards } from "../../mock/reports";
import { mockState } from "./state";

export class ReportsMockRepository implements ReportsRepository {
  async getReportCards(): Promise<ReportCard[]> {
    await delay(250);
    const leads = mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId);
    const users = mockState.users.filter((u) => u.tenantId === mockState.currentTenantId);
    return computeReportCards(leads, users);
  }
}
