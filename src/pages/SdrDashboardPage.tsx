import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { ROUTES } from "../constants/routes";
import { useSdrCampaigns } from "../hooks/useSdrCampaigns";
import { useSdrCoverage } from "../hooks/useSdrCoverage";
import { useSdrDashboardCosts, useSdrDashboardOverview } from "../hooks/useSdrDashboard";
import { SDR_PRIORITY_LABEL, type SdrFunnelSummary, type SdrScoreOutcomeBucket } from "../types/sdr";
import styles from "./SdrPages.module.css";

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ratioLabel(count: number, base: number): string {
  if (base <= 0) return "";
  return ` (${((count / base) * 100).toFixed(0)}% de ${base})`;
}

function FunnelSection({ funnel }: { funnel: SdrFunnelSummary }) {
  const steps: Array<{ label: string; count: number; base: number }> = [
    { label: "Encontrados", count: funnel.encontrados, base: funnel.encontrados },
    { label: "Qualificados (Score A/B)", count: funnel.qualificados, base: funnel.encontrados },
    { label: "Aprovados", count: funnel.aprovados, base: funnel.encontrados },
    { label: "Contatados", count: funnel.contatados, base: funnel.aprovados },
    { label: "Ganhos", count: funnel.ganhos, base: funnel.contatados },
    { label: "Perdidos", count: funnel.perdidos, base: funnel.contatados },
  ];
  const maxCount = Math.max(1, ...steps.map((s) => s.count));

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Funil</h2>
      {funnel.encontrados === 0 ? (
        <p className={styles.pageSubtitle}>Nenhum candidate encontrado ainda no período.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((step) => (
            <div key={step.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{step.label}</span>
                <span>
                  {step.count}
                  {step.base !== step.count && ratioLabel(step.count, step.base)}
                </span>
              </div>
              <div style={{ background: "var(--tone-gray-bg)", borderRadius: 4, height: 8 }}>
                <div
                  style={{
                    width: `${(step.count / maxCount) * 100}%`,
                    background: "var(--tone-green)",
                    borderRadius: 4,
                    height: 8,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {funnel.stageDistribution.length > 0 && (
        <>
          <h3 className={styles.cardTitle} style={{ fontSize: 14, marginTop: 16 }}>
            Distribuição por estágio atual
          </h3>
          <p className={styles.pageSubtitle} style={{ fontSize: 12 }}>
            Nomes reais configurados no funil de prospecção — nunca fixos.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Estágio</th>
                <th>Prospects</th>
              </tr>
            </thead>
            <tbody>
              {funnel.stageDistribution.map((item) => (
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
        </>
      )}
    </div>
  );
}

function ScoreOutcomeSection({ buckets }: { buckets: SdrScoreOutcomeBucket[] }) {
  const hasAnyApproved = buckets.some((b) => b.aprovados > 0);
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Score GSM × Resultado</h2>
      {!hasAnyApproved ? (
        <p className={styles.pageSubtitle}>Sem candidates aprovados com Score ainda.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Prioridade</th>
              <th>Aprovados</th>
              <th>Contatados</th>
              <th>Taxa de contato</th>
              <th>Ganhos</th>
              <th>Taxa de ganho</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.priority}>
                <td>{SDR_PRIORITY_LABEL[bucket.priority]}</td>
                <td>{bucket.aprovados}</td>
                <td>{bucket.contatados}</td>
                <td>{formatPercent(bucket.taxaContato)}</td>
                <td>{bucket.ganhos}</td>
                <td>{formatPercent(bucket.taxaGanho)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.pageSubtitle} style={{ fontSize: 12, marginTop: 8 }}>
        Taxas só aparecem com amostra suficiente (evita "1 lead = 100%").
      </p>
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
            Funil real, Score × resultado e custos — sem inventar dado que o histórico não
            comprova.
          </p>
        </div>
      </div>

      {loading && <div className={styles.empty}>Carregando…</div>}
      {error && <EmptyState title="Não foi possível carregar o dashboard" message={error.message} />}

      {overview && (
        <>
          <FunnelSection funnel={overview.funnel} />
          <ScoreOutcomeSection buckets={overview.scoreOutcome} />

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Insights</h2>
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
        </>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Custos por provider</h2>
        {!costs || costs.length === 0 ? (
          <p className={styles.pageSubtitle}>Nenhum consumo registrado ainda.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Chamadas</th>
                <th>Unidades</th>
                <th>Custo estimado</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((entry) => (
                <tr key={entry.provider}>
                  <td>{entry.provider}</td>
                  <td>{entry.callsCount}</td>
                  <td>{entry.totalUnits}</td>
                  <td>{formatCents(entry.totalCostCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Campanhas e cobertura</h2>
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
  );
}
