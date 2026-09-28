import styles from "./EmptyState.module.css";

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  /** Ex.: "Tentar de novo" depois de um erro de carregamento. */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={styles.wrap} role={action ? "alert" : undefined}>
      <div className={styles.icon}>⚙</div>
      <div className={styles.title}>{title}</div>
      <div className={styles.message}>{message}</div>
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
