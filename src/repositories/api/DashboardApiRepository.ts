import type { DashboardRepository } from "../DashboardRepository";
import type { DashboardMetrics } from "../../types/dashboard";
import type { Period } from "../../utils/periods";
import { apiRequest } from "./ApiClient";
import { originOf } from "../../constants/origins";
import { isToday, weekdayShortLabel } from "../../utils/dates";
import { shortCurrency } from "../../utils/currency";
import { NO_ATTENTION } from "../../types/dashboard";

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
  value?: number;
  without_value?: number;
}

interface WeekBarDto {
  date: string;
  count: number;
}

interface DashboardExtrasDto {
  open_without_value?: number;
  won_without_value?: number;
  stalled?: { lead_id: string; name: string; days: number }[];
  owner_breakdown?: {
    owner_id: string | null;
    total: number;
    open: number;
    closed: number;
    lost: number;
    closed_revenue: number;
  }[];
  previous?: {
    date_from: string;
    date_to: string;
    total_leads: number;
    closed: number;
    lost: number;
    conversion_rate: number;
    closed_revenue: number;
  } | null;
  attention?: {
    tasks_overdue: number;
    tasks_today: number;
    stalled_leads: number;
    renewals_next_30_days: number;
    clients_overdue: number;
  };
}

interface DashboardMetricsDto extends DashboardExtrasDto {
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
  // CADA etapa real do pipeline, na ordem real — o backend já entrega
  // `label`/`color` por etapa (mesma regra do quadro desde a Etapa 1).
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
    valueLabel: `R$ ${shortCurrency(Math.round(stage.value ?? 0))}`,
    withoutValue: stage.without_value ?? 0,
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
    avgCloseDays: dto.avg_close_days,
    open: dto.open,
    lost: dto.lost,
    originLegend: toOriginLegend(dto.origin_breakdown),
    funnel: toFunnel(dto.funnel, dto.total_leads),
    weekSeries: toWeekSeries(dto.week_series),
    // API antiga (deploy do front antes do back): campos novos ausentes = sem informação, não zero inventado.
    openWithoutValue: dto.open_without_value ?? 0,
    wonWithoutValue: dto.won_without_value ?? 0,
    stalled: (dto.stalled ?? []).map((s) => ({ id: s.lead_id, name: s.name, days: s.days })),
    owners: (dto.owner_breakdown ?? []).map((o) => ({
      ownerId: o.owner_id,
      total: o.total,
      open: o.open,
      closed: o.closed,
      lost: o.lost,
      closedRevenue: o.closed_revenue,
    })),
    previous: dto.previous
      ? {
          dateFrom: dto.previous.date_from,
          dateTo: dto.previous.date_to,
          totalLeads: dto.previous.total_leads,
          closed: dto.previous.closed,
          lost: dto.previous.lost,
          conversionRate: Math.round(dto.previous.conversion_rate),
          closedRevenue: dto.previous.closed_revenue,
        }
      : null,
    attention: dto.attention
      ? {
          tasksOverdue: dto.attention.tasks_overdue,
          tasksToday: dto.attention.tasks_today,
          stalledLeads: dto.attention.stalled_leads,
          renewalsNext30Days: dto.attention.renewals_next_30_days,
          clientsOverdue: dto.attention.clients_overdue,
        }
      : NO_ATTENTION,
  };
}

export class DashboardApiRepository implements DashboardRepository {
  async getMetrics(period?: Period, pipelineId?: string): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    if (pipelineId) params.set("pipeline_id", pipelineId);
    if (period?.dateFrom) params.set("date_from", period.dateFrom);
    if (period?.dateTo) params.set("date_to", period.dateTo);
    const query = params.toString();
    const path = query ? `/api/v1/dashboard?${query}` : "/api/v1/dashboard";
    const dto = await apiRequest<DashboardMetricsDto>(path);
    return toDashboardMetrics(dto);
  }
}
