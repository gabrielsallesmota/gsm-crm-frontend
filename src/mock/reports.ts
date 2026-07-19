import type { Lead } from "../types/lead";
import type { User } from "../types/user";
import type { ReportCard } from "../types/report";
import { STAGES, STAGE_ORDER } from "../constants/stages";
import { shortCurrency } from "../utils/currency";
import { computeDashboardMetrics } from "./dashboard";

function maxOf(values: number[]): number {
  return Math.max(1, ...values);
}

export function computeReportCards(leads: Lead[], users: User[]): ReportCard[] {
  const { funnel, originLegend } = computeDashboardMetrics(leads);
  const lost = leads.filter((l) => l.stage === "perdido");

  const bySeller = users.map((u) => ({
    label: u.name.split(" ")[0] ?? u.name,
    total: leads.filter((l) => l.ownerId === u.id).length,
    won: leads.filter((l) => l.ownerId === u.id && l.stage === "ganho").length,
  }));

  const lossReasons: Record<string, number> = {};
  for (const l of lost) {
    const reason = l.lossReason || "Outro";
    lossReasons[reason] = (lossReasons[reason] ?? 0) + 1;
  }

  const revenueByStage = STAGE_ORDER.map((key) => ({
    key,
    value: leads.filter((l) => l.stage === key).reduce((sum, l) => sum + l.value, 0),
  }));
  const maxRevenue = maxOf(revenueByStage.map((x) => x.value));

  const maxOrigin = maxOf(originLegend.map((o) => o.count));
  const maxSellerTotal = maxOf(bySeller.map((x) => x.total));
  const maxSellerWon = maxOf(bySeller.map((x) => Math.max(1, x.won)));
  const maxLoss = maxOf(Object.values(lossReasons));

  const cards: ReportCard[] = [
    {
      title: "Conversão por etapa",
      subtitle: "Leads em cada fase",
      bars: funnel.map((f) => ({ label: f.label, widthPct: f.widthPct, value: String(f.count), color: f.color })),
    },
    {
      title: "Leads por origem",
      subtitle: "Canais de entrada",
      bars: originLegend.map((o) => ({
        label: o.label,
        widthPct: Math.round((o.count / maxOrigin) * 100) + "%",
        value: String(o.count),
        color: "#2ee66e",
      })),
    },
    {
      title: "Leads por vendedor",
      subtitle: "Distribuição da equipe",
      bars: bySeller.map((x) => ({
        label: x.label,
        widthPct: Math.round((x.total / maxSellerTotal) * 100) + "%",
        value: String(x.total),
        color: "#4aa3ff",
      })),
    },
    {
      title: "Clientes ganhos",
      subtitle: "Fechados por vendedor",
      bars: bySeller.map((x) => ({
        label: x.label,
        widthPct: Math.round((x.won / maxSellerWon) * 100) + "%",
        value: String(x.won),
        color: "#2ee66e",
      })),
    },
    {
      title: "Motivos de perda",
      subtitle: "Por que perdemos",
      bars: Object.keys(lossReasons).length
        ? Object.entries(lossReasons).map(([reason, count]) => ({
            label: reason,
            widthPct: Math.round((count / maxLoss) * 100) + "%",
            value: String(count),
            color: "#ff6b6b",
          }))
        : [{ label: "Sem perdas", widthPct: "4%", value: "0", color: "#9aa6b2" }],
    },
    {
      title: "Receita por etapa",
      subtitle: "Valor em cada fase",
      bars: revenueByStage.map((x) => ({
        label: STAGES[x.key].label,
        widthPct: Math.round((x.value / maxRevenue) * 100) + "%",
        value: "R$ " + shortCurrency(x.value),
        color: STAGES[x.key].color,
      })),
    },
  ];

  return cards;
}
