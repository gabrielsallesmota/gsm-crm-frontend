import styles from "./Badge.module.css";

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className={styles.badge} style={{ color, background: bg }}>
      {label}
    </span>
  );
}
