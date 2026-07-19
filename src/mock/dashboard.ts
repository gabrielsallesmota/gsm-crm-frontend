import type { Lead } from "../types/lead";
import type { DashboardMetrics } from "../types/dashboard";
import { STAGES, STAGE_ORDER } from "../constants/stages";
import { ORIGIN, ORIGIN_KEYS } from "../constants/origins";
import { daysSince, isToday, weekdayShortLabel } from "../utils/dates";

export function computeDashboardMetrics(leads: Lead[]): DashboardMetrics {
  const total = leads.length;
  const closed = leads.filter((l) => l.stage === "ganho");
  const lost = leads.filter((l) => l.stage === "perdido");
  const open = leads.filter((l) => l.stage !== "ganho" && l.stage !== "perdido");

  const conversionRate = total ? Math.round((closed.length / total) * 100) : 0;
  const forecastRevenue = open.reduce((sum, l) => sum + l.value * (l.probability / 100), 0);
  const closedRevenue = closed.reduce((sum, l) => sum + l.value, 0);
  const avgFirstContactHours = total
    ? leads.reduce((sum, l) => sum + (l.firstContactHours || 0), 0) / total
    : 0;

  const closedWithTime = closed.filter((l) => l.closedAt);
  const avgCloseDays = closedWithTime.length
    ? closedWithTime.reduce((sum, l) => sum + daysSince(l.closedAt as string), 0) /
      closedWithTime.length
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

  const funnel = STAGE_ORDER.map((key) => {
    const count = leads.filter((l) => l.stage === key).length;
    return {
      key,
      label: STAGES[key].label,
      color: STAGES[key].color,
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
    avgFirstContactHours,
    avgCloseDays,
    open: open.length,
    lost: lost.length,
    originLegend,
    funnel,
    weekSeries,
  };
}
