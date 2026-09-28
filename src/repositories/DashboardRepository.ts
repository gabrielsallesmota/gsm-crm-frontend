import type { DashboardMetrics } from "../types/dashboard";
import type { Period } from "../utils/periods";

export interface DashboardRepository {
  /** `pipelineId` omitido = pipeline padrão do tenant. */
  getMetrics(period?: Period, pipelineId?: string): Promise<DashboardMetrics>;
}
