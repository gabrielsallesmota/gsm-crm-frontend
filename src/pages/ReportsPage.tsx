import { useReports } from "../hooks/useReports";
import { EmptyState } from "../components/common/EmptyState";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  // Sem branch de `notImplemented` de propósito — mesma razão de
  // `DashboardPage.tsx`: `ReportsApiRepository` já chama `GET /api/v1/reports`
  // de verdade e nunca lança `NotImplementedError`.
  const { data, loading, error } = useReports();

  return (
    <div>
      <h1 className={styles.pageTitle}>Relatórios</h1>
      <p className={styles.pageSubtitle}>Desempenho do funil e da equipe</p>

      {error && <EmptyState title="Não foi possível carregar os relatórios" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

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
