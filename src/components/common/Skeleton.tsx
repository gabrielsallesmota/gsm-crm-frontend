import styles from "./Skeleton.module.css";

/**
 * Esqueleto de carregamento (Etapa 4) — no lugar de "Carregando…" solto
 * na primeira carga de listas e cards. Recargas mantêm o conteúdo antigo
 * na tela (`aria-busy`), sem piscar.
 */
export function SkeletonRows({ rows = 5, label = "Carregando" }: { rows?: number; label?: string }) {
  return (
    <div className={styles.rows} role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.row} aria-hidden="true">
          <span className={`${styles.block} ${styles.avatar}`} />
          <span className={styles.lines}>
            <span className={`${styles.block} ${styles.line}`} style={{ width: `${70 - (i % 3) * 12}%` }} />
            <span className={`${styles.block} ${styles.lineShort}`} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6, label = "Carregando" }: { count?: number; label?: string }) {
  return (
    <div className={styles.cards} role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card} aria-hidden="true">
          <span className={`${styles.block} ${styles.lineShort}`} />
          <span className={`${styles.block} ${styles.value}`} />
        </div>
      ))}
    </div>
  );
}
