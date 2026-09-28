import { KpiIcon } from "./KpiIcon";
import styles from "./KpiCard.module.css";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  highlight = false,
  valueColor,
  definition,
}: {
  label: string;
  value: string;
  hint: string;
  icon: Parameters<typeof KpiIcon>[0]["name"];
  highlight?: boolean;
  valueColor?: string;
  /** Como o número é calculado (tooltip + leitor de tela). */
  definition?: string;
}) {
  return (
    <div
      className={highlight ? `${styles.card} ${styles.highlight}` : styles.card}
      title={definition}
      aria-description={definition}
    >
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
