import type { DashboardRepository } from "../DashboardRepository";
import type { DashboardMetrics } from "../../types/dashboard";
import type { Period } from "../../utils/periods";
import { apiRequest } from "./ApiClient";
import { originOf } from "../../constants/origins";
import { isToday, weekdayShortLabel } from "../../utils/dates";

interface OriginBreakdownDto {
  origin: string;
  count: number;
  pct: number;
}

interface FunnelStageDto {
  stage_id: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

interface WeekBarDto {
  date: string;
  count: number;
}

interface DashboardMetricsDto {
  pipeline_id: string | null;
  total_leads: number;
  today: number;
  week: number;
  month: number;
  closed: number;
  open: number;
  lost: number;
  conversion_rate: number;
  forecast_revenue: number;
  closed_revenue: number;
  avg_close_days: number | null;
  origin_breakdown: OriginBreakdownDto[];
  funnel: FunnelStageDto[];
  week_series: WeekBarDto[];
}

function pctLabel(value: number): string {
  return `${Math.round(value)}%`;
}

function toOriginLegend(items: OriginBreakdownDto[]): DashboardMetrics["originLegend"] {
  // As chaves de `LeadOrigin` do backend (`landing_page`, `whatsapp`, ...)
  // são as mesmas de `constants/origins.ts` — reaproveita o mesmo mapa de
  // label/cor usado pelo modo Demo, sem duplicar a paleta aqui.
  return items.map((item) => {
    const meta = originOf(item.origin);
    return { key: item.origin, label: meta.label, color: meta.color, count: item.count, pct: pctLabel(item.pct) };
  });
}

function toFunnel(stages: FunnelStageDto[], totalLeads: number): DashboardMetrics["funnel"] {
  // Diferente de `stageMapping.ts` (usado por Leads/Pipeline, que colapsa
  // os estágios reais em 5 chaves fixas do protótipo), o dashboard mostra
  // CADA estágio real do pipeline — o backend já entrega `label`/`color`
  // por estágio, então não há necessidade do colapso aqui.
  return stages.map((stage) => ({
    key: stage.stage_id,
    label: stage.label,
    color: stage.color,
    count: stage.count,
    // Mesma regra do modo Demo (`mock/dashboard.ts`): com pipeline vazio,
    // barra em 0%; havendo qualquer lead no pipeline, toda raia mostra pelo
    // menos 6% de largura (mesmo com 0 leads nela) para continuar visível.
    widthPct: totalLeads > 0 ? `${Math.max(6, Math.round(stage.pct))}%` : "0%",
    pct: pctLabel(stage.pct),
  }));
}

function toWeekSeries(bars: WeekBarDto[]): DashboardMetrics["weekSeries"] {
  const maxCount = Math.max(1, ...bars.map((b) => b.count));
  return bars.map((bar) => {
    // Meio-dia local (sem timezone) evita o dia "virar" um a menos por
    // fuso horário quando `date` (YYYY-MM-DD, sem hora) vira `Date` — ver
    // `utils/dates.ts`, que assume string ISO com componente de hora.
    const iso = `${bar.date}T12:00:00`;
    return {
      day: weekdayShortLabel(iso),
      count: bar.count,
      heightPct: `${Math.round((bar.count / maxCount) * 100)}%`,
      isToday: isToday(iso),
    };
  });
}

/**
 * O backend ainda não registra o momento do primeiro contato/resposta de um
 * lead — só `created_at`/`updated_at`/`last_interaction_at` (ver
 * `app/modules/leads/domain/entities.py`). Mesma lacuna já documentada em
 * `LeadsApiRepository.toLead` (`firstContactHours: 0`); usamos o mesmo
 * placeholder neutro aqui até o backend passar a registrar esse timestamp.
 */
const AVG_FIRST_CONTACT_HOURS_PLACEHOLDER = 0;

function toDashboardMetrics(dto: DashboardMetricsDto): DashboardMetrics {
  return {
    totalLeads: dto.total_leads,
    today: dto.today,
    week: dto.week,
    month: dto.month,
    closed: dto.closed,
    conversionRate: Math.round(dto.conversion_rate),
    forecastRevenue: dto.forecast_revenue,
    closedRevenue: dto.closed_revenue,
    avgFirstContactHours: AVG_FIRST_CONTACT_HOURS_PLACEHOLDER,
    avgCloseDays: dto.avg_close_days,
    open: dto.open,
    lost: dto.lost,
    originLegend: toOriginLegend(dto.origin_breakdown),
    funnel: toFunnel(dto.funnel, dto.total_leads),
    weekSeries: toWeekSeries(dto.week_series),
  };
}

export class DashboardApiRepository implements DashboardRepository {
  async getMetrics(period?: Period): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    if (period?.dateFrom) params.set("date_from", period.dateFrom);
    if (period?.dateTo) params.set("date_to", period.dateTo);
    const query = params.toString();
    const path = query ? `/api/v1/dashboard?${query}` : "/api/v1/dashboard";
    const dto = await apiRequest<DashboardMetricsDto>(path);
    return toDashboardMetrics(dto);
  }
}
