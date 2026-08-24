import type { ReportsRepository } from "../ReportsRepository";
import type { ReportCard } from "../../types/report";
import { apiRequest } from "./ApiClient";
import { originOf } from "../../constants/origins";
import { shortCurrency } from "../../utils/currency";

interface FunnelStageDto {
  stage_id: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

interface OriginDto {
  origin: string;
  count: number;
  pct: number;
}

interface SellerDto {
  user_id: string;
  name: string;
  total: number;
  won: number;
}

interface StageRevenueDto {
  stage_id: string;
  label: string;
  color: string;
  revenue: number;
}

interface ReportDataDto {
  funnel: FunnelStageDto[];
  origin_breakdown: OriginDto[];
  by_seller: SellerDto[];
  revenue_by_stage: StageRevenueDto[];
}

function maxOf(values: number[]): number {
  return Math.max(1, ...values);
}

function pctWidth(value: number, max: number): string {
  return `${Math.round((value / max) * 100)}%`;
}

/**
 * Monta os `ReportCard`s a partir dos números crus do backend — mesma
 * divisão de responsabilidade de `DashboardApiRepository` (backend devolve
 * dado, frontend decide pixel/formatação). Sem card de "motivos de perda"
 * de propósito: `Lead` não tem esse campo no backend ainda (ver
 * `reports/application/dtos.py` no backend) — melhor omitir o card do que
 * inventar um dado que não existe.
 */
function toReportCards(data: ReportDataDto): ReportCard[] {
  const maxOrigin = maxOf(data.origin_breakdown.map((o) => o.count));
  const maxSellerTotal = maxOf(data.by_seller.map((s) => s.total));
  const maxSellerWon = maxOf(data.by_seller.map((s) => Math.max(1, s.won)));
  const maxRevenue = maxOf(data.revenue_by_stage.map((r) => r.revenue));

  return [
    {
      title: "Conversão por etapa",
      subtitle: "Leads em cada fase",
      bars: data.funnel.map((f) => ({
        label: f.label,
        widthPct: `${Math.round(f.pct)}%`,
        value: String(f.count),
        color: f.color,
      })),
    },
    {
      title: "Leads por origem",
      subtitle: "Canais de entrada",
      bars: data.origin_breakdown.map((o) => ({
        label: originOf(o.origin).label,
        widthPct: pctWidth(o.count, maxOrigin),
        value: String(o.count),
        color: "#2ee66e",
      })),
    },
    {
      title: "Leads por vendedor",
      subtitle: "Distribuição da equipe",
      bars: data.by_seller.map((s) => ({
        label: s.name.split(" ")[0] ?? s.name,
        widthPct: pctWidth(s.total, maxSellerTotal),
        value: String(s.total),
        color: "#4aa3ff",
      })),
    },
    {
      title: "Clientes ganhos",
      subtitle: "Fechados por vendedor",
      bars: data.by_seller.map((s) => ({
        label: s.name.split(" ")[0] ?? s.name,
        widthPct: pctWidth(s.won, maxSellerWon),
        value: String(s.won),
        color: "#2ee66e",
      })),
    },
    {
      title: "Receita por etapa",
      subtitle: "Valor em cada fase",
      bars: data.revenue_by_stage.map((r) => ({
        label: r.label,
        widthPct: pctWidth(r.revenue, maxRevenue),
        value: `R$ ${shortCurrency(r.revenue)}`,
        color: r.color,
      })),
    },
  ];
}

export class ReportsApiRepository implements ReportsRepository {
  async getReportCards(): Promise<ReportCard[]> {
    const data = await apiRequest<ReportDataDto>("/api/v1/reports");
    return toReportCards(data);
  }
}
