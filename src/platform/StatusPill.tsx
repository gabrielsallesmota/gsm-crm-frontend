import styles from "./Platform.module.css";

export function StatusPill({ status, internal = false }: { status: string; internal?: boolean }) {
  if (internal) return <span className={`${styles.pill} ${styles.pillInternal}`}>Interna GSM</span>;
  if (status === "suspended")
    return <span className={`${styles.pill} ${styles.pillSuspended}`}>Suspensa</span>;
  if (status === "active") return <span className={`${styles.pill} ${styles.pillActive}`}>Ativa</span>;
  return <span className={`${styles.pill} ${styles.pillNeutral}`}>{status}</span>;
}
