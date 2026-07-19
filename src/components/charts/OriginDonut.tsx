import type { OriginLegendItem } from "../../types/dashboard";
import styles from "./OriginDonut.module.css";

export function OriginDonut({ legend, total }: { legend: OriginLegendItem[]; total: number }) {
  let acc = 0;
  const segments = legend.map((item) => {
    const start = (acc / Math.max(1, total)) * 360;
    acc += item.count;
    const end = (acc / Math.max(1, total)) * 360;
    return `${item.color} ${start}deg ${end}deg`;
  });
  const gradient = segments.length
    ? `conic-gradient(${segments.join(",")})`
    : "conic-gradient(rgba(255,255,255,.08) 0deg 360deg)";

  return (
    <div className={styles.card}>
      <div className={styles.title}>Origem dos leads</div>
      <div className={styles.subtitle}>De onde eles vêm</div>
      <div className={styles.body}>
        <div className={styles.donut} style={{ background: gradient }}>
          <div className={styles.donutHole}>
            <div className={styles.donutTotal}>{total}</div>
            <div className={styles.donutLabel}>leads</div>
          </div>
        </div>
        <div className={styles.legend}>
          {legend.map((item) => (
            <div key={item.key} className={styles.legendRow}>
              <span className={styles.dot} style={{ background: item.color }} />
              <span className={styles.legendLabel}>{item.label}</span>
              <span className={styles.legendCount}>{item.count}</span>
              <span className={styles.legendPct}>{item.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
