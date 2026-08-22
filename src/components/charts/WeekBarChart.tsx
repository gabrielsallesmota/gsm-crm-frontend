import type { WeekBar } from "../../types/dashboard";
import styles from "./WeekBarChart.module.css";

export function WeekBarChart({
  series,
  title = "Leads nos últimos 7 dias",
  subtitle = "Entradas por dia",
}: {
  series: WeekBar[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>{title}</div>
      <div className={styles.subtitle}>{subtitle}</div>
      <div className={styles.bars}>
        {series.map((bar, i) => (
          <div key={i} className={styles.col}>
            <div className={styles.count}>{bar.count}</div>
            <div
              className={bar.isToday ? `${styles.bar} ${styles.barToday}` : styles.bar}
              style={{ height: `max(6px, ${bar.heightPct})` }}
            />
            <div className={styles.day}>{bar.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
