import type { ReportsRepository } from "../ReportsRepository";
import type { ReportCard } from "../../types/report";
import { NotImplementedError } from "../../utils/errors";

export class ReportsApiRepository implements ReportsRepository {
  async getReportCards(): Promise<ReportCard[]> {
    throw new NotImplementedError("Relatórios");
  }
}
