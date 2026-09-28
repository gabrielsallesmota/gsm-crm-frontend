import { useToast } from "../../hooks/useToast";
import type { ToastVariant } from "../../contexts/ToastContext";
import styles from "./ToastHost.module.css";

const ICON: Record<ToastVariant, string> = {
  success: "✓",
  error: "!",
  warning: "⚠",
  info: "i",
};

const LABEL: Record<ToastVariant, string> = {
  success: "Sucesso",
  error: "Erro",
  warning: "Atenção",
  info: "Informação",
};

export function ToastHost() {
  const { toasts, dismiss } = useToast();
  // Duas regiões vivas: erro/aviso interrompem o leitor de tela
  // (`assertive`), sucesso/info esperam (`polite`).
  const urgent = toasts.filter((t) => t.variant === "error" || t.variant === "warning");
  const calm = toasts.filter((t) => t.variant === "success" || t.variant === "info");
  const render = (list: typeof toasts) =>
    list.map((t) => (
      <div key={t.id} className={`${styles.toast} ${styles[t.variant]}`}>
        <span className={styles.icon} aria-hidden="true">
          {ICON[t.variant]}
        </span>
        <span className={styles.srOnly}>{LABEL[t.variant]}: </span>
        <span className={styles.message}>{t.message}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => dismiss(t.id)}
          aria-label="Fechar aviso"
        >
          ×
        </button>
      </div>
    ));
  return (
    <div className={styles.host}>
      <div role="alert" aria-live="assertive" className={styles.stack}>
        {render(urgent)}
      </div>
      <div role="status" aria-live="polite" className={styles.stack}>
        {render(calm)}
      </div>
    </div>
  );
}
