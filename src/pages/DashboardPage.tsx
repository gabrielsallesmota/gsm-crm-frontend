import { lazy, Suspense, useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { KpiCard } from "../components/kpi/KpiCard";
import { WeekBarChart } from "../components/charts/WeekBarChart";
import { OriginDonut } from "../components/charts/OriginDonut";
import { SalesFunnel } from "../components/charts/SalesFunnel";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonCards } from "../components/common/Skeleton";
import { OnboardingChecklist } from "../components/onboarding/OnboardingChecklist";
import { usePageTitle } from "../hooks/usePageTitle";
import { ROUTES } from "../constants/routes";
import { PeriodFilter } from "../components/common/PeriodFilter";
// Dashboard de prospecção é INTERNO da GSM — chunk próprio (ver PipelinePage).
const ProspectDashboardSection = lazy(() =>
  import("../components/prospects/ProspectDashboardSection").then((m) => ({
    default: m.ProspectDashboardSection,
  })),
);
import { AttentionPanel } from "../components/dashboard/AttentionPanel";
import { OwnerRanking } from "../components/dashboard/OwnerRanking";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import type { DashboardMetrics } from "../types/dashboard";
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

type Delta = { text: string; good: boolean | null };
const VS = "vs período anterior";

/** Variação de uma contagem contra o período anterior; `upIsGood=false` para o que não se quer (perdidos). */
function countDelta(current: number, previous: number, upIsGood = true): Delta {
  const diff = current - previous;
  if (diff === 0) return { text: `= igual ${VS}`, good: null };
  return { text: `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} ${VS}`, good: diff > 0 === upIsGood };
}

function pointsDelta(current: number, previous: number): Delta {
  const diff = current - previous;
  if (diff === 0) return { text: `= igual ${VS}`, good: null };
  return { text: `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} p.p. ${VS}`, good: diff > 0 };
}

function moneyDelta(current: number, previous: number): Delta {
  const diff = Math.round(current - previous);
  if (diff === 0) return { text: `= igual ${VS}`, good: null };
  return {
    text: `${diff > 0 ? "▲" : "▼"} R$ ${shortCurrency(Math.abs(diff))} ${VS}`,
    good: diff > 0,
  };
}

/** Deltas só existem com período filtrado (o backend não manda `previous` sem ele). */
function deltasOf(data: DashboardMetrics) {
  const p = data.previous;
  if (!p) return {};
  return {
    total: countDelta(data.totalLeads, p.totalLeads),
    closed: countDelta(data.closed, p.closed),
    lost: countDelta(data.lost, p.lost, false),
    conversion: pointsDelta(data.conversionRate, p.conversionRate),
    revenue: moneyDelta(data.closedRevenue, p.closedRevenue),
  };
}

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
  usePageTitle("Dashboard");

  return (
    <div>
      <OnboardingChecklist />
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
              aria-pressed={sourceFilter === option}
            >
              {SOURCE_FILTER_LABEL[option]}
            </button>
          ))}
        </div>
      )}

      <PeriodFilter value={period} onChange={setPeriod} />

      {showPassivo && (
        <LeadsDashboardSection
          taggedPassivo={isSuperAdmin}
          period={period}
          onClearPeriod={() => setPeriod(EMPTY_PERIOD)}
        />
      )}

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
  stalled:
    "Leads em andamento sem nenhuma interação há 7 dias ou mais (ou nunca contatados, contando da criação). Vale a carteira inteira, não só o período filtrado.",
  lost: "Leads que estão numa etapa marcada como PERDA.",
} as const;

function LeadsDashboardSection({
  taggedPassivo,
  period,
  onClearPeriod,
}: {
  taggedPassivo: boolean;
  period: Period;
  onClearPeriod: () => void;
}) {
  const { user } = useAuth();
  const ownOnly = !can(user, "leads.viewAll");
  const { data: pipelines } = usePipelines();
  const { data: team } = useTeamDirectory();
  const [pipelineId, setPipelineId] = useState("");
  const { data, loading, error, reload } = useDashboard(period, pipelineId || undefined);
  const scopeHint = ownOnly ? "seus leads" : "toda a equipe";
  const periodActive = JSON.stringify(period) !== JSON.stringify(EMPTY_PERIOD);
  // Etapa 4: sem nenhum lead, 11 zeros não dizem nada — mostramos o que
  // falta para o dashboard ganhar vida. Com filtro de período, "vazio" é
  // só "nada neste período".
  const empty = data !== null && data.totalLeads === 0;
  const deltas = data ? deltasOf(data) : {};
  const att = data?.attention;
  const hasPending =
    !!att &&
    att.tasksOverdue +
      att.tasksToday +
      att.stalledLeads +
      att.clientsOverdue +
      att.renewalsNext30Days >
      0;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Dashboard
          </h1>
          <p className={styles.pageSubtitle}>
            Visão geral do funil · {scopeHint}
            {empty ? "" : " · toque no ? de cada indicador para ver como é calculado"}
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
          tone="error"
          title="Não foi possível carregar o dashboard"
          message={error.message}
          actions={[{ label: "Tentar de novo", onClick: reload }]}
        />
      )}

      {loading && !data && !error && <SkeletonCards count={8} label="Carregando indicadores" />}

      {empty && periodActive && (
        <EmptyState
          title="Nenhum lead neste período"
          message="Não há leads criados no intervalo escolhido. Tente um período maior ou veja todos."
          actions={[{ label: "Ver todo o período", onClick: onClearPeriod }]}
        />
      )}

      {empty && !periodActive && (
        <EmptyState
          title={ownOnly ? "Você ainda não tem leads" : "Seu dashboard aparece aqui"}
          message={
            ownOnly
              ? "Assim que um lead for atribuído a você (ou você cadastrar um), os números da sua carteira aparecem aqui: novos leads, ganhos, conversão e receita."
              : "Os indicadores são calculados a partir dos seus leads. Cadastre o primeiro, importe uma planilha ou conecte o formulário do seu site — os números aparecem aqui automaticamente."
          }
          actions={[
            { label: "Adicionar lead", to: `${ROUTES.leads}?novo=1` },
            ...(ownOnly
              ? []
              : [{ label: "Importar planilha", to: `${ROUTES.pipeline}?importar=1` }]),
            ...(can(user, "integrations.manage")
              ? [{ label: "Conectar site ou WhatsApp", to: ROUTES.integracoes }]
              : []),
          ]}
        />
      )}

      {data && (!empty || hasPending) && (
        <AttentionPanel
          attention={data.attention}
          stalled={data.stalled}
          scope={ownOnly ? "seus" : "da equipe"}
        />
      )}

      {data && !empty && (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard
              label="Total de leads"
              value={String(data.totalLeads)}
              hint="no recorte"
              {...(deltas.total ? { delta: deltas.total } : {})}
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
              {...(deltas.closed ? { delta: deltas.closed } : {})}
              definition={KPI_DEFINITIONS.closed}
              icon="closed"
              valueColor="var(--tone-green)"
            />
            <KpiCard
              label="Taxa de conversão"
              value={data.totalLeads > 0 ? `${data.conversionRate}%` : "—"}
              hint={data.totalLeads > 0 ? "ganhos / total" : "sem leads no recorte"}
              {...(deltas.conversion ? { delta: deltas.conversion } : {})}
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
              hint={
                data.wonWithoutValue > 0
                  ? `valor dos ganhos · ${data.wonWithoutValue} sem valor`
                  : "valor dos ganhos"
              }
              {...(deltas.revenue ? { delta: deltas.revenue } : {})}
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
              {...(deltas.lost ? { delta: deltas.lost } : {})}
              definition={KPI_DEFINITIONS.lost}
              icon="lost"
            />
            <KpiCard
              label="Leads parados"
              value={String(data.attention.stalledLeads)}
              hint="em aberto, sem contato há 7+ dias"
              definition={KPI_DEFINITIONS.stalled}
              icon="open"
              {...(data.attention.stalledLeads > 0 ? { valueColor: "var(--tone-amber)" } : {})}
            />
          </div>

          {data.openWithoutValue > 0 && (
            <p className={styles.dataNote} role="note">
              <strong>{data.openWithoutValue}</strong>{" "}
              {data.openWithoutValue === 1 ? "lead em andamento está" : "leads em andamento estão"}{" "}
              sem valor: a <em>Receita prevista</em> os conta como R$ 0. Preencha o valor esperado
              no cadastro do lead para a previsão refletir a carteira inteira.
            </p>
          )}

          <div className={styles.chartsGrid}>
            <WeekBarChart series={data.weekSeries} />
            <OriginDonut legend={data.originLegend} total={data.totalLeads} />
          </div>

          <div className={styles.funnelRow}>
            <SalesFunnel funnel={data.funnel} />
          </div>

          {!ownOnly && <OwnerRanking owners={data.owners} team={team ?? []} />}
        </>
      )}
    </div>
  );
}
