import { useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { KpiCard } from "../components/kpi/KpiCard";
import { WeekBarChart } from "../components/charts/WeekBarChart";
import { OriginDonut } from "../components/charts/OriginDonut";
import { SalesFunnel } from "../components/charts/SalesFunnel";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { PeriodFilter } from "../components/common/PeriodFilter";
import { ProspectDashboardSection } from "../components/prospects/ProspectDashboardSection";
import { shortCurrency } from "../utils/currency";
import { EMPTY_PERIOD, type Period } from "../utils/periods";
import styles from "./DashboardPage.module.css";

type SourceFilter = "todos" | "ativo" | "passivo";

const SOURCE_FILTER_LABEL: Record<SourceFilter, string> = {
  todos: "Todos",
  ativo: "Ativo (prospecção)",
  passivo: "Passivo (leads)",
};

const PASSIVO_BADGE = { label: "Passivo", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" };

export function DashboardPage() {
  // O backend não expõe mais acesso de plataforma neste objeto (Fase 2/3 —
  // `is_super_admin` foi removido de `/auth/me` e do JWT; o mecanismo real
  // agora é `platform_staff`, sem sinal no frontend até a Fase 10). Até lá,
  // a seção "Prospecção" fica desligada para todo mundo — mais seguro que
  // assumir acesso sem ter como verificar.
  const isSuperAdmin = false;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("todos");
  const [period, setPeriod] = useState<Period>(EMPTY_PERIOD);
  const showPassivo = !isSuperAdmin || sourceFilter !== "ativo";
  const showAtivo = isSuperAdmin && sourceFilter !== "passivo";

  return (
    <div>
      {isSuperAdmin && (
        <div className={styles.sourceFilter}>
          {(["todos", "ativo", "passivo"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                sourceFilter === option
                  ? `${styles.sourceFilterBtn} ${styles.sourceFilterBtnActive}`
                  : styles.sourceFilterBtn
              }
              onClick={() => setSourceFilter(option)}
            >
              {SOURCE_FILTER_LABEL[option]}
            </button>
          ))}
        </div>
      )}

      <PeriodFilter value={period} onChange={setPeriod} />

      {showPassivo && <LeadsDashboardSection taggedPassivo={isSuperAdmin} period={period} />}

      {showPassivo && showAtivo && <div className={styles.sourceDivider} />}

      {showAtivo && <ProspectDashboardSection period={period} />}
    </div>
  );
}

function LeadsDashboardSection({
  taggedPassivo,
  period,
}: {
  taggedPassivo: boolean;
  period: Period;
}) {
  // Sem branch de `notImplemented` aqui de propósito: `DashboardApiRepository`
  // já chama `GET /api/v1/dashboard` de verdade (existe desde a Fase 3) e
  // nunca lança `NotImplementedError` — o branch antigo nunca disparava em
  // produção, só documentava uma lacuna que já foi fechada.
  const { data, loading, error } = useDashboard(period);

  return (
    <div>
      <h1 className={styles.pageTitle}>
        {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Dashboard
      </h1>
      <p className={styles.pageSubtitle}>Visão geral do funil</p>

      {error && <EmptyState title="Não foi possível carregar o dashboard" message={error.message} />}

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
