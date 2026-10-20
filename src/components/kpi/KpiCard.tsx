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
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  icon: Parameters<typeof KpiIcon>[0]["name"];
  highlight?: boolean;
  valueColor?: string;
  /** Como o número é calculado — botão "?" (toque, teclado e mouse). */
  definition?: string;
  /** Variação contra o período anterior (só com período filtrado). `good` decide a cor. */
  delta?: { text: string; good: boolean | null };
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
      {delta && (
        <div
          className={
            delta.good === null
              ? styles.delta
              : delta.good
                ? `${styles.delta} ${styles.deltaGood}`
                : `${styles.delta} ${styles.deltaBad}`
          }
        >
          {delta.text}
        </div>
      )}
    </div>
  );
}
