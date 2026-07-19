import { useToast } from "../../hooks/useToast";
import styles from "./ToastHost.module.css";

export function ToastHost() {
  const { toasts } = useToast();
  return (
    <div className={styles.host}>
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          <span className={styles.check}>✓</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
