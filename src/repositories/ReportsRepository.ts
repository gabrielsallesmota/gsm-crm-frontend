import type { ReportCard } from "../types/report";

export interface ReportsRepository {
  getReportCards(): Promise<ReportCard[]>;
}
