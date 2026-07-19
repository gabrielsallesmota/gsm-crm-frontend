import { KpiIcon } from "./KpiIcon";
import styles from "./KpiCard.module.css";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  highlight = false,
  valueColor,
}: {
  label: string;
  value: string;
  hint: string;
  icon: Parameters<typeof KpiIcon>[0]["name"];
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div className={highlight ? `${styles.card} ${styles.highlight}` : styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon}>
          <KpiIcon name={icon} />
        </span>
      </div>
      <div className={styles.value} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className={styles.hint}>{hint}</div>
    </div>
  );
}
