import styles from "./EmptyState.module.css";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>⚙</div>
      <div className={styles.title}>{title}</div>
      <div className={styles.message}>{message}</div>
    </div>
  );
}
