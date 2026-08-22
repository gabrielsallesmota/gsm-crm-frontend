import type { FunnelStage } from "../../types/dashboard";
import styles from "./SalesFunnel.module.css";

export function SalesFunnel({
  funnel,
  title = "Funil de vendas",
  subtitle = "Leads por etapa",
}: {
  funnel: FunnelStage[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>{title}</div>
      <div className={styles.subtitle}>{subtitle}</div>
      <div className={styles.rows}>
        {funnel.map((stage) => (
          <div key={stage.key} className={styles.row}>
            <div className={styles.label}>{stage.label}</div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: stage.widthPct, background: stage.color }}>
                {stage.count}
              </div>
            </div>
            <div className={styles.pct}>{stage.pct}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
