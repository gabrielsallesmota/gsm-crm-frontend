import { useProspectDashboard } from "../../hooks/useProspectDashboard";
import { KpiCard } from "../kpi/KpiCard";
import { WeekBarChart } from "../charts/WeekBarChart";
import { SalesFunnel } from "../charts/SalesFunnel";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import { PRIORITY } from "../../constants/prospectEnums";
import { isToday, weekdayShortLabel } from "../../utils/dates";
import type { Period } from "../../utils/periods";
import type { FunnelStage, WeekBar } from "../../types/dashboard";
import type { ProspectDashboardMetrics, ProspectPriority } from "../../types/prospect";
import styles from "./ProspectDashboardSection.module.css";

function pctLabel(value: number): string {
  return `${Math.round(value)}%`;
}

function toFunnel(metrics: ProspectDashboardMetrics): FunnelStage[] {
  return metrics.funnel.map((stage) => ({
    key: stage.stageId,
    label: stage.label,
    color: stage.color,
    count: stage.count,
    widthPct: metrics.total > 0 ? `${Math.max(6, Math.round(stage.pct))}%` : "0%",
    pct: pctLabel(stage.pct),
  }));
}

function toWeekSeries(metrics: ProspectDashboardMetrics): WeekBar[] {
  const maxCount = Math.max(1, ...metrics.weekSeries.map((b) => b.count));
  return metrics.weekSeries.map((bar) => {
    const iso = `${bar.date}T12:00:00`;
    return {
      day: weekdayShortLabel(iso),
      count: bar.count,
      heightPct: `${Math.round((bar.count / maxCount) * 100)}%`,
      isToday: isToday(iso),
    };
  });
}

/** Seção "Ativo (prospecção)" do Dashboard — mesma UI (KpiCard/WeekBarChart/
 * SalesFunnel) reaproveitada do dashboard de leads, só trocando a fonte de
 * dados. Só monta quando o filtro Ativo/Todos está selecionado (ver
 * `DashboardPage.tsx`) — hook busca ao montar, não fica pedindo à toa. */
export function ProspectDashboardSection({ period }: { period: Period }) {
  const { data, loading, notImplemented, error } = useProspectDashboard(period);

  if (notImplemented) {
    return (
      <EmptyState
        title="Não disponível no modo Demonstração"
        message="Prospecção GSM é uma área interna, sem dados fictícios para mostrar aqui."
      />
    );
  }
  if (error) {
    return <EmptyState title="Não foi possível carregar a prospecção" message={error.message} />;
  }
  if (loading || !data) return <div className={styles.loading}>Carregando…</div>;

  return (
    <div>
      <h2 className={styles.sectionHeader}>
        <Badge label="Ativo" color="#a78bfa" bg="rgba(167,139,250,.16)" />
        Prospecção GSM
      </h2>
      <p className={styles.sectionSubtitle}>Carteira comercial interna</p>

      <div className={styles.kpiGrid}>
        <KpiCard label="Total de prospects" value={String(data.total)} hint="na carteira" icon="leads" highlight />
        <KpiCard label="Hoje" value={String(data.today)} hint="entraram hoje" icon="today" valueColor="#4aa3ff" />
        <KpiCard label="Na semana" value={String(data.week)} hint="últimos 7 dias" icon="week" />
        <KpiCard label="No mês" value={String(data.month)} hint="últimos 30 dias" icon="month" />
        <KpiCard label="Fechados" value={String(data.won)} hint="negócios ganhos" icon="closed" valueColor="#2ee66e" />
        <KpiCard
          label="Taxa de conversão"
          value={`${Math.round(data.conversionRate)}%`}
          hint="ganhos / total"
          icon="conversion"
          valueColor="#f5b13d"
        />
        <KpiCard label="Em aberto" value={String(data.open)} hint="em prospecção" icon="open" valueColor="#f5b13d" />
        <KpiCard label="Perdidos" value={String(data.lost)} hint="sem retorno" icon="lost" />
      </div>

      <div className={styles.chartsGrid}>
        <WeekBarChart
          series={toWeekSeries(data)}
          title="Prospects nos últimos 7 dias"
          subtitle="Entradas por dia"
        />
        <div className={styles.priorityCard}>
          <p className={styles.priorityTitle}>Prioridade</p>
          <p className={styles.prioritySubtitle}>Distribuição da carteira</p>
          {data.priorityBreakdown.map((item) => {
            const meta = PRIORITY[item.priority as ProspectPriority];
            return (
              <div key={item.priority} className={styles.priorityRow}>
                <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                <span>
                  {item.count} ({Math.round(item.pct)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <SalesFunnel funnel={toFunnel(data)} title="Funil de prospecção" subtitle="Prospects por etapa" />
    </div>
  );
}
