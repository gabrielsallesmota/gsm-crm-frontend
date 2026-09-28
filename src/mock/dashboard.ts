import type { Lead } from "../types/lead";
import type { DashboardMetrics } from "../types/dashboard";
import type { PipelineStage } from "../types/pipeline";
import { ORIGIN, ORIGIN_KEYS } from "../constants/origins";
import { daysSince, isToday, weekdayShortLabel } from "../utils/dates";

/** Métricas da DEMONSTRAÇÃO, calculadas sobre as etapas REAIS do pipeline
 * (ganho/perdido pelas flags da etapa, nunca por nome). */
export function computeDashboardMetrics(leads: Lead[], stages: PipelineStage[]): DashboardMetrics {
  const total = leads.length;
  const byId = new Map(stages.map((s) => [s.id, s]));
  const closed = leads.filter((l) => byId.get(l.stageId)?.isWon);
  const lost = leads.filter((l) => byId.get(l.stageId)?.isLost);
  const open = leads.filter((l) => !byId.get(l.stageId)?.isWon && !byId.get(l.stageId)?.isLost);

  const conversionRate = total ? Math.round((closed.length / total) * 100) : 0;
  const forecastRevenue = open.reduce((sum, l) => sum + l.value * (l.probability / 100), 0);
  const closedRevenue = closed.reduce((sum, l) => sum + l.value, 0);
  const avgCloseDays = closed.length
    ? closed.reduce(
        (sum, l) => sum + Math.max(0, daysSince(l.createdAt) - daysSince(l.updatedAt)),
        0,
      ) / closed.length
    : null;

  const today = leads.filter((l) => isToday(l.createdAt)).length;
  const week = leads.filter((l) => daysSince(l.createdAt) <= 6).length;
  const month = leads.filter((l) => daysSince(l.createdAt) <= 30).length;

  const maxDay = Math.max(1, ...[0, 1, 2, 3, 4, 5, 6].map((d) => leads.filter((l) => daysSince(l.createdAt) === d).length));
  const weekSeries = [6, 5, 4, 3, 2, 1, 0].map((d) => {
    const count = leads.filter((l) => daysSince(l.createdAt) === d).length;
    const refDate = new Date();
    refDate.setDate(refDate.getDate() - d);
    return {
      day: weekdayShortLabel(refDate.toISOString()),
      count,
      heightPct: Math.round((count / maxDay) * 100) + "%",
      isToday: d === 0,
    };
  });

  const originCounts: Record<string, number> = {};
  for (const key of ORIGIN_KEYS) originCounts[key] = leads.filter((l) => l.origin === key).length;
  const originActive = ORIGIN_KEYS.filter((key) => (originCounts[key] ?? 0) > 0);
  const originLegend = originActive.map((key) => {
    const count = originCounts[key] ?? 0;
    return {
      key,
      label: ORIGIN[key].label,
      color: ORIGIN[key].color,
      count,
      pct: total ? Math.round((count / total) * 100) + "%" : "0%",
    };
  });

  const funnel = stages.map((stage) => {
    const count = leads.filter((l) => l.stageId === stage.id).length;
    return {
      key: stage.id,
      label: stage.label,
      color: stage.color,
      count,
      widthPct: total ? Math.max(6, Math.round((count / total) * 100)) + "%" : "0%",
      pct: total ? Math.round((count / total) * 100) + "%" : "0%",
    };
  });

  return {
    totalLeads: total,
    today,
    week,
    month,
    closed: closed.length,
    conversionRate,
    forecastRevenue,
    closedRevenue,
    avgCloseDays,
    open: open.length,
    lost: lost.length,
    originLegend,
    funnel,
    weekSeries,
  };
}
