import { useEffect } from "react";
import type { ReactNode } from "react";
import styles from "./Modal.module.css";

/** Modal genérico centralizado (overlay escuro + card no meio da tela) —
 * clique fora ou Esc fecha. Usado pra edição de registros nas telas de
 * gestão (terapeutas, procedimentos, espaços etc.), em vez do formulário
 * inline "some no topo da lista longa" de antes. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{title}</h2>
        {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
