import { lazy, Suspense, useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { KpiCard } from "../components/kpi/KpiCard";
import { WeekBarChart } from "../components/charts/WeekBarChart";
import { OriginDonut } from "../components/charts/OriginDonut";
import { SalesFunnel } from "../components/charts/SalesFunnel";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { PeriodFilter } from "../components/common/PeriodFilter";
// Dashboard de prospecção é INTERNO da GSM — chunk próprio (ver PipelinePage).
const ProspectDashboardSection = lazy(() =>
  import("../components/prospects/ProspectDashboardSection").then((m) => ({
    default: m.ProspectDashboardSection,
  })),
);
import { shortCurrency } from "../utils/currency";
import { EMPTY_PERIOD, type Period } from "../utils/periods";
import { useAuth } from "../hooks/useAuth";
import { usePipelines } from "../hooks/usePipelines";
import { can } from "../auth/permissions";
import styles from "./DashboardPage.module.css";

type SourceFilter = "todos" | "ativo" | "passivo";

const SOURCE_FILTER_LABEL: Record<SourceFilter, string> = {
  todos: "Todos",
  ativo: "Ativo (prospecção)",
  passivo: "Passivo (leads)",
};

const PASSIVO_BADGE = { label: "Passivo", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" };

export function DashboardPage() {
  // Prospecção (funil comercial próprio da GSM) é restrita a platform staff
  // no backend — `isPlatformStaff` vem de `GET /auth/me` (ver `types/auth.ts`).
  const { user } = useAuth();
  const isSuperAdmin = can(user, "platform.internal");
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

      {showAtivo && (
        <Suspense fallback={null}>
          <ProspectDashboardSection period={period} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Definição de cada KPI (Etapa 1) — fonte: `GET /api/v1/dashboard`
 * (`GetDashboardMetricsUseCase`). Tudo é calculado sobre os leads do
 * PIPELINE escolhido (padrão: o pipeline padrão), criados dentro do PERÍODO
 * filtrado (sem período = todos), com dias no fuso America/Sao_Paulo.
 * Vendedor vê só os próprios leads. Ganho/perdido = flag da etapa (nunca o
 * nome). Sem base suficiente → "—" (nunca um 0 inventado). O antigo
 * "1º atendimento" foi REMOVIDO: o backend não registra primeiro contato e
 * a tela mostrava sempre "0min".
 */
const KPI_DEFINITIONS = {
  total: "Leads do pipeline criados no período filtrado.",
  today: "Leads criados hoje (dia de São Paulo), dentro do filtro.",
  week: "Leads criados nos últimos 7 dias, incluindo hoje.",
  month: "Leads criados nos últimos 31 dias, incluindo hoje.",
  closed: "Leads que estão numa etapa marcada como GANHO.",
  conversion: "Ganhos ÷ total de leads do recorte. Sem leads = indisponível.",
  forecast: "Soma de valor × probabilidade dos leads em etapas em andamento.",
  closedRevenue: "Soma do valor dos leads em etapa de ganho.",
  closeTime:
    "Média de dias entre a criação e a última mudança de etapa dos leads ganhos. Sem ganhos = indisponível.",
  open: "Leads em etapas que não são de ganho nem de perda.",
  lost: "Leads que estão numa etapa marcada como PERDA.",
} as const;

function LeadsDashboardSection({
  taggedPassivo,
  period,
}: {
  taggedPassivo: boolean;
  period: Period;
}) {
  const { user } = useAuth();
  const ownOnly = !can(user, "leads.viewAll");
  const { data: pipelines } = usePipelines();
  const [pipelineId, setPipelineId] = useState("");
  const { data, loading, error, reload } = useDashboard(period, pipelineId || undefined);
  const scopeHint = ownOnly ? "seus leads" : "toda a equipe";

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Dashboard
          </h1>
          <p className={styles.pageSubtitle}>
            Visão geral do funil · {scopeHint} · passe o mouse nos indicadores para ver a definição
          </p>
        </div>
        {pipelines && pipelines.length > 1 && (
          <select
            className={styles.pipelineSelect}
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            aria-label="Pipeline"
          >
            <option value="">Pipeline padrão</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar o dashboard"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}

      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard
              label="Total de leads"
              value={String(data.totalLeads)}
              hint="no recorte"
              definition={KPI_DEFINITIONS.total}
              icon="leads"
              highlight
            />
            <KpiCard
              label="Leads hoje"
              value={String(data.today)}
              hint="entraram hoje"
              definition={KPI_DEFINITIONS.today}
              icon="today"
              valueColor="var(--tone-blue)"
            />
            <KpiCard
              label="Na semana"
              value={String(data.week)}
              hint="últimos 7 dias"
              definition={KPI_DEFINITIONS.week}
              icon="week"
            />
            <KpiCard
              label="No mês"
              value={String(data.month)}
              hint="últimos 31 dias"
              definition={KPI_DEFINITIONS.month}
              icon="month"
            />
            <KpiCard
              label="Negócios ganhos"
              value={String(data.closed)}
              hint="em etapa de ganho"
              definition={KPI_DEFINITIONS.closed}
              icon="closed"
              valueColor="var(--tone-green)"
            />
            <KpiCard
              label="Taxa de conversão"
              value={data.totalLeads > 0 ? `${data.conversionRate}%` : "—"}
              hint={data.totalLeads > 0 ? "ganhos / total" : "sem leads no recorte"}
              definition={KPI_DEFINITIONS.conversion}
              icon="conversion"
              valueColor="var(--tone-amber)"
            />
            <KpiCard
              label="Receita prevista"
              value={`R$ ${shortCurrency(Math.round(data.forecastRevenue))}`}
              hint="valor × probabilidade"
              definition={KPI_DEFINITIONS.forecast}
              icon="forecast"
              valueColor="var(--tone-purple)"
            />
            <KpiCard
              label="Receita ganha"
              value={`R$ ${shortCurrency(data.closedRevenue)}`}
              hint="valor dos ganhos"
              definition={KPI_DEFINITIONS.closedRevenue}
              icon="revenue"
              highlight
            />
            <KpiCard
              label="Até o ganho"
              value={data.avgCloseDays != null ? `${data.avgCloseDays.toFixed(0)}d` : "—"}
              hint={data.avgCloseDays != null ? "tempo médio" : "sem ganhos no recorte"}
              definition={KPI_DEFINITIONS.closeTime}
              icon="closeTime"
            />
            <KpiCard
              label="Em aberto"
              value={String(data.open)}
              hint="em negociação"
              definition={KPI_DEFINITIONS.open}
              icon="open"
              valueColor="var(--tone-amber)"
            />
            <KpiCard
              label="Perdidos"
              value={String(data.lost)}
              hint="em etapa de perda"
              definition={KPI_DEFINITIONS.lost}
              icon="lost"
            />
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
