import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./HelpTip.module.css";

/**
 * Ajuda contextual curta (Etapa 4): um "?" ao lado de um título que abre
 * um balão com 2–4 frases. Clique/Enter abre, Esc ou clique fora fecha.
 * Não é tooltip de hover: funciona no toque e no teclado. Conteúdo:
 * `<span>` por parágrafo (o balão vive dentro de títulos/parágrafos, onde
 * `<p>` seria HTML inválido).
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className={styles.wrap} ref={wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Ajuda: ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className={styles.bubble}>
          <strong className={styles.bubbleTitle}>{label}</strong>
          {children}
        </span>
      )}
    </span>
  );
}
