import { Link } from "react-router-dom";
import styles from "./EmptyState.module.css";

/**
 * Estado sem conteúdo — padrão único (Etapa 4) para os casos:
 * - `empty`: ainda não há dados → explica e oferece o próximo passo;
 * - `error`: falha ao carregar → "Tentar de novo";
 * - `forbidden`: sem permissão / não contratado;
 * - `offline`: sem conexão;
 * - `done`: lista vazia por um bom motivo (ex.: nenhuma tarefa atrasada).
 *
 * Ações: botão (`onClick`) ou link de rota (`to`). A primeira é a
 * principal (destacada).
 */
export type EmptyTone = "empty" | "error" | "forbidden" | "offline" | "done";

export interface EmptyAction {
  label: string;
  onClick?: () => void;
  to?: string;
}

const ICON: Record<EmptyTone, string> = {
  empty: "✦",
  error: "!",
  forbidden: "🔒",
  offline: "⌁",
  done: "✓",
};

export function EmptyState({
  title,
  message,
  action,
  actions,
  tone,
  compact = false,
}: {
  title: string;
  message: string;
  /** Atalho para uma ação única (compatível com o uso anterior). */
  action?: EmptyAction;
  actions?: EmptyAction[];
  /** Sem `tone`: `error` quando há `action` isolada (uso histórico
   * "Tentar de novo"), senão `empty`. */
  tone?: EmptyTone;
  /** Versão menor, para dentro de cards/listas. */
  compact?: boolean;
}) {
  const list = actions ?? (action ? [action] : []);
  const kind: EmptyTone = tone ?? (action && !actions ? "error" : "empty");
  return (
    <div
      className={`${styles.wrap} ${compact ? styles.compact : ""} ${styles[kind]}`}
      role={kind === "error" || kind === "offline" ? "alert" : undefined}
    >
      <div className={styles.icon} aria-hidden="true">
        {ICON[kind]}
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.message}>{message}</div>
      {list.length > 0 && (
        <div className={styles.actions}>
          {list.map((a, i) =>
            a.to ? (
              <Link
                key={a.label}
                to={a.to}
                className={`${styles.action} ${i === 0 ? styles.primary : ""}`}
              >
                {a.label}
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                className={`${styles.action} ${i === 0 ? styles.primary : ""}`}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
