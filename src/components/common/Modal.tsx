import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { useDialog } from "../../hooks/useDialog";
import styles from "./Modal.module.css";

/** Modal genérico centralizado (overlay escuro + card no meio da tela).
 *
 * Acessibilidade (Etapa 4): `role="dialog"` + `aria-modal`, título como
 * nome acessível, foco preso dentro e devolvido ao fechar, Esc fecha.
 *
 * Proteção de dados: depois que a pessoa digita qualquer coisa num campo,
 * clique fora e Esc deixam de fechar — só Cancelar/× descartam. Assim um
 * toque acidental no fundo (comum no celular) não apaga o formulário. */
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
  const ref = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const titleId = useId();
  const subtitleId = useId();
  useDialog(ref, onClose, () => dirty.current);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !dirty.current) onClose();
      }}
    >
      <div
        ref={ref}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        onInput={() => {
          dirty.current = true;
        }}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.modalTitle}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {subtitle && (
          <p id={subtitleId} className={styles.modalSubtitle}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
