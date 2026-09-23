import { useNavigate } from "react-router-dom";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { KpiCard } from "../components/kpi/KpiCard";
import { SalesFunnel } from "../components/charts/SalesFunnel";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { ROUTES } from "../constants/routes";
import { useSdrCampaigns } from "../hooks/useSdrCampaigns";
import { useSdrCoverage } from "../hooks/useSdrCoverage";
import { useSdrDashboardCosts, useSdrDashboardOverview } from "../hooks/useSdrDashboard";
import { SDR_PRIORITY_LABEL, type SdrPriority, type SdrScoreOutcomeBucket } from "../types/sdr";
import type { FunnelStage } from "../types/dashboard";
import styles from "./SdrPages.module.css";

const PRIORITY_COLOR: Record<SdrPriority, { color: string; bg: string }> = {
  a: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  b: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  c: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toFunnelStages(funnel: {
  encontrados: number;
  qualificados: number;
  aprovados: number;
  contatados: number;
  ganhos: number;
}): FunnelStage[] {
  const base = funnel.encontrados || 1;
  const steps: Array<{ key: string; label: string; color: string; count: number }> = [
    { key: "encontrados", label: "Encontrados", color: "var(--tone-gray)", count: funnel.encontrados },
    { key: "qualificados", label: "Qualificados", color: "var(--tone-purple)", count: funnel.qualificados },
    { key: "aprovados", label: "Aprovados", color: "var(--tone-blue)", count: funnel.aprovados },
    { key: "contatados", label: "Contatados", color: "var(--tone-amber)", count: funnel.contatados },
    { key: "ganhos", label: "Ganhos", color: "var(--tone-green)", count: funnel.ganhos },
  ];
  return steps.map((step) => {
    const pct = (step.count / base) * 100;
    return {
      key: step.key,
      label: step.label,
      color: step.color,
      count: step.count,
      widthPct: `${Math.max(6, Math.round(pct))}%`,
      pct: `${Math.round(pct)}%`,
    };
  });
}

function ScoreOutcomePanel({ buckets }: { buckets: SdrScoreOutcomeBucket[] }) {
  const hasAnyApproved = buckets.some((b) => b.aprovados > 0);
  return (
    <div className={styles.sidePanel}>
      <p className={styles.sidePanelTitle}>Score × Resultado</p>
      <p className={styles.sidePanelSubtitle}>Taxa de contato/ganho por prioridade</p>
      {!hasAnyApproved ? (
        <p className={styles.pageSubtitle}>Sem candidates aprovados com Score ainda.</p>
      ) : (
        buckets.map((bucket) => (
          <div key={bucket.priority} className={styles.sidePanelRow}>
            <Badge label={SDR_PRIORITY_LABEL[bucket.priority]} {...PRIORITY_COLOR[bucket.priority]} />
            <span>
              {bucket.aprovados} aprov. · contato {formatPercent(bucket.taxaContato)} · ganho{" "}
              {formatPercent(bucket.taxaGanho)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export function SdrDashboardPage() {
  const navigate = useNavigate();
  const { data: overview, loading, error } = useSdrDashboardOverview();
  const { data: costs } = useSdrDashboardCosts();
  const { data: campaigns } = useSdrCampaigns();
  const { data: coverage } = useSdrCoverage();

  const activeCampaigns = campaigns?.filter((c) => c.status === "active").length ?? null;
  const coveredCombinations = coverage?.filter((c) => c.status === "concluida").length ?? null;

  return (
    <div>
      <SdrSubNav />
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard SDR</h1>
          <p className={styles.pageSubtitle}>
            Funil real, Score × resultado e custos — sem inventar dado que o histórico não comprova.
          </p>
        </div>
      </div>

      {loading && <div className={styles.empty}>Carregando…</div>}
      {error && <EmptyState title="Não foi possível carregar o dashboard" message={error.message} />}

      {overview && (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard label="Encontrados" value={String(overview.funnel.encontrados)} hint="candidates no total" icon="leads" highlight />
            <KpiCard label="Qualificados" value={String(overview.funnel.qualificados)} hint="Score prioridade A/B" icon="conversion" valueColor="var(--tone-purple)" />
            <KpiCard label="Aprovados" value={String(overview.funnel.aprovados)} hint="viraram Prospect" icon="closed" valueColor="var(--tone-blue)" />
            <KpiCard label="Contatados" value={String(overview.funnel.contatados)} hint="primeiro contato confirmado" icon="today" valueColor="var(--tone-amber)" />
            <KpiCard label="Ganhos" value={String(overview.funnel.ganhos)} hint="fecharam como cliente" icon="revenue" valueColor="var(--tone-green)" />
            <KpiCard label="Perdidos" value={String(overview.funnel.perdidos)} hint="não converteram" icon="lost" />
          </div>

          <div className={styles.chartsGrid}>
            <ScoreOutcomePanel buckets={overview.scoreOutcome} />
            <div className={styles.sidePanel}>
              <p className={styles.sidePanelTitle}>Custos por provider</p>
              <p className={styles.sidePanelSubtitle}>Consumo já registrado</p>
              {!costs || costs.length === 0 ? (
                <p className={styles.pageSubtitle}>Nenhum consumo registrado ainda.</p>
              ) : (
                costs.map((entry) => (
                  <div key={entry.provider} className={styles.sidePanelRow}>
                    <span>{entry.provider}</span>
                    <span>
                      {entry.callsCount}x · {formatCents(entry.totalCostCents)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.funnelRow}>
            {overview.funnel.encontrados === 0 ? (
              <div className={styles.card}>
                <p className={styles.cardTitle}>Funil</p>
                <p className={styles.pageSubtitle}>Nenhum candidate encontrado ainda no período.</p>
              </div>
            ) : (
              <SalesFunnel
                funnel={toFunnelStages(overview.funnel)}
                title="Funil do SDR"
                subtitle="Encontrados → qualificados → aprovados → contatados → ganhos"
              />
            )}
          </div>

          <div className={styles.secondaryGrid}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Distribuição por estágio atual</p>
              {overview.funnel.stageDistribution.length === 0 ? (
                <p className={styles.pageSubtitle}>Sem prospect em nenhum estágio ainda.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Estágio</th>
                      <th>Prospects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.funnel.stageDistribution.map((item) => (
                      <tr key={item.stageId}>
                        <td>
                          {item.stageName}
                          {item.isWon && " (ganho)"}
                          {item.isLost && " (perdido)"}
                        </td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.card}>
              <p className={styles.cardTitle}>Insights</p>
              {overview.insights.length === 0 ? (
                <p className={styles.pageSubtitle}>
                  Ainda sem dado suficiente pra gerar insight (amostra mínima não atingida).
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {overview.insights.map((insight) => (
                    <li key={insight.text} className={styles.pageSubtitle}>
                      {insight.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.card}>
              <p className={styles.cardTitle}>Campanhas e cobertura</p>
              <p className={styles.pageSubtitle}>
                {activeCampaigns === null ? "—" : `${activeCampaigns} campanha(s) ativa(s)`} ·{" "}
                {coveredCombinations === null
                  ? "—"
                  : `${coveredCombinations} combinação(ões) de nicho/local já cobertas`}
              </p>
              <div className={styles.modalActions} style={{ justifyContent: "flex-start" }}>
                <Button onClick={() => navigate(ROUTES.sdrCampanhas)}>Ver campanhas</Button>
                <Button onClick={() => navigate(ROUTES.sdrCobertura)}>Ver cobertura</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
