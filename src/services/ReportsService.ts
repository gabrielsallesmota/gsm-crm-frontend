import type { ReportsRepository } from "../repositories/ReportsRepository";
import { ReportsApiRepository } from "../repositories/api/ReportsApiRepository";
import { ReportsMockRepository } from "../repositories/mock/ReportsMockRepository";
import { CRM_MODE } from "./factory";
import type { ReportCard } from "../types/report";

const repo: ReportsRepository = CRM_MODE === "demo" ? new ReportsMockRepository() : new ReportsApiRepository();

export class ReportsService {
  getReportCards(): Promise<ReportCard[]> {
    return repo.getReportCards();
  }
}

export const reportsService = new ReportsService();
