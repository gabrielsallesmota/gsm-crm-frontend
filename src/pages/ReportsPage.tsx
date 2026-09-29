import { useReports } from "../hooks/useReports";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonCards } from "../components/common/Skeleton";
import { usePageTitle } from "../hooks/usePageTitle";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  // Sem branch de `notImplemented` de propósito — mesma razão de
  // `DashboardPage.tsx`: `ReportsApiRepository` já chama `GET /api/v1/reports`
  // de verdade e nunca lança `NotImplementedError`.
  const { data, loading, error, reload } = useReports();
  usePageTitle("Relatórios");

  return (
    <div>
      <h1 className={styles.pageTitle}>Relatórios</h1>
      <p className={styles.pageSubtitle}>Desempenho do funil e da equipe</p>

      {error && (
        <EmptyState
          tone="error"
          title="Não foi possível carregar os relatórios"
          message={error.message}
          actions={[{ label: "Tentar de novo", onClick: reload }]}
        />
      )}
      {loading && !data && !error && <SkeletonCards count={4} label="Carregando relatórios" />}
      {data && data.length === 0 && (
        <EmptyState
          title="Ainda não há dados para relatórios"
          message="Os relatórios mostram o desempenho do funil e da equipe assim que houver leads cadastrados."
        />
      )}

      {data && (
        <div className={styles.grid}>
          {data.map((card) => (
            <div key={card.title} className={styles.card}>
              <div className={styles.cardTitle}>{card.title}</div>
              <div className={styles.cardSubtitle}>{card.subtitle}</div>
              <div className={styles.bars}>
                {card.bars.map((bar) => (
                  <div key={bar.label} className={styles.barRow}>
                    <div className={styles.barLabel}>{bar.label}</div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: bar.widthPct, background: bar.color }} />
                    </div>
                    <div className={styles.barValue}>{bar.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
