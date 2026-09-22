import { useState } from "react";
import styles from "../../pages/SdrPages.module.css";

/** Lista de chips em estado LOCAL (não persiste item a item como
 * `ManageLossReasonsModal` — aqui é só um campo de formulário comum,
 * ex. termos de busca/ofertas GSM de uma campanha) — inspirado no mesmo
 * padrão de add/remove, mas sem chamada de API por item. */
export function SdrChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <div className={styles.chipAddRow}>
        <input
          className={styles.input}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={styles.smallRemoveBtn} onClick={add}>
          Adicionar
        </button>
      </div>
      {values.length > 0 && (
        <div className={styles.chipList}>
          {values.map((v) => (
            <span key={v} className={styles.chip}>
              {v}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remover ${v}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
