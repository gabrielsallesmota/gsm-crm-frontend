import { KpiIcon } from "./KpiIcon";
import { HelpTip } from "../common/HelpTip";
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
  /** Como o número é calculado — botão "?" (toque, teclado e mouse). */
  definition?: string;
}) {
  return (
    <div
      className={highlight ? `${styles.card} ${styles.highlight}` : styles.card}
    >
      <div className={styles.top}>
        <span className={styles.label}>
          {label}
          {definition && (
            <HelpTip label={label}>
              <span>{definition}</span>
            </HelpTip>
          )}
        </span>
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
