import { useDashboard } from "../hooks/useDashboard";
import { KpiCard } from "../components/kpi/KpiCard";
import { WeekBarChart } from "../components/charts/WeekBarChart";
import { OriginDonut } from "../components/charts/OriginDonut";
import { SalesFunnel } from "../components/charts/SalesFunnel";
import { EmptyState } from "../components/common/EmptyState";
import { shortCurrency } from "../utils/currency";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const { data, loading, notImplemented, error } = useDashboard();

  return (
    <div>
      <h1 className={styles.pageTitle}>Dashboard</h1>
      <p className={styles.pageSubtitle}>Visão geral do funil</p>

      {notImplemented && (
        <EmptyState
          title="Dashboard disponível apenas no modo Demo por enquanto"
          message="O backend ainda não expõe métricas agregadas de dashboard — só autenticação, leads e pipelines. Assim que esse endpoint existir, esta tela passa a funcionar em produção sem nenhuma mudança de interface."
        />
      )}

      {error && !notImplemented && <EmptyState title="Não foi possível carregar o dashboard" message={error.message} />}

      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard label="Total de leads" value={String(data.totalLeads)} hint="na empresa" icon="leads" highlight />
            <KpiCard label="Leads hoje" value={String(data.today)} hint="entraram hoje" icon="today" valueColor="#4aa3ff" />
            <KpiCard label="Na semana" value={String(data.week)} hint="últimos 7 dias" icon="week" />
            <KpiCard label="No mês" value={String(data.month)} hint="últimos 30 dias" icon="month" />
            <KpiCard label="Clientes fechados" value={String(data.closed)} hint="negócios ganhos" icon="closed" valueColor="#2ee66e" />
            <KpiCard label="Taxa de conversão" value={`${data.conversionRate}%`} hint="ganhos / total" icon="conversion" valueColor="#f5b13d" />
            <KpiCard label="Receita prevista" value={`R$ ${shortCurrency(Math.round(data.forecastRevenue))}`} hint="ponderada pela prob." icon="forecast" valueColor="#a78bfa" />
            <KpiCard label="Receita fechada" value={`R$ ${shortCurrency(data.closedRevenue)}`} hint="já ganho" icon="revenue" highlight />
            <KpiCard
              label="1º atendimento"
              value={data.avgFirstContactHours < 1 ? `${Math.round(data.avgFirstContactHours * 60)}min` : `${data.avgFirstContactHours.toFixed(1)}h`}
              hint="tempo médio"
              icon="firstContact"
              valueColor="#4aa3ff"
            />
            <KpiCard label="Até fechamento" value={data.avgCloseDays != null ? `${data.avgCloseDays.toFixed(0)}d` : "—"} hint="tempo médio" icon="closeTime" />
            <KpiCard label="Em aberto" value={String(data.open)} hint="em negociação" icon="open" valueColor="#f5b13d" />
            <KpiCard label="Perdidos" value={String(data.lost)} hint="no período" icon="lost" />
          </div>

          <div className={styles.chartsGrid}>
            <WeekBarChart series={data.weekSeries} />
            <OriginDonut legend={data.originLegend} total={data.totalLeads} />
          </div>

          <div className={styles.funnelRow}>
            <SalesFunnel funnel={data.funnel} />
          </div>
        </>
      )}
    </div>
  );
}
