import { useId, useState } from "react";
import { findSuggestion } from "../../utils/searchTerms";
import styles from "../../pages/SdrPages.module.css";

/** Lista de chips em estado LOCAL (não persiste item a item como
 * `ManageLossReasonsModal` — aqui é só um campo de formulário comum,
 * ex. termos de busca/ofertas GSM de uma campanha) — inspirado no mesmo
 * padrão de add/remove, mas sem chamada de API por item.
 *
 * `suggestions` vira uma lista de escolha (datalist). Com
 * `restrictToSuggestions`, só entra termo da lista (comparação sem
 * acento/caixa, gravando a grafia oficial) — usado quando o provider da
 * campanha tem vocabulário fechado (Geoapify). Chip antigo fora da lista
 * fica marcado pra ser trocado. */
export function SdrChipInput({
  values,
  onChange,
  placeholder,
  suggestions,
  restrictToSuggestions = false,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  suggestions?: readonly string[] | undefined;
  restrictToSuggestions?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const restricted = restrictToSuggestions && suggestions !== undefined;

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    let value = trimmed;
    if (restricted) {
      const match = findSuggestion(trimmed, suggestions);
      if (!match) {
        setError(`"${trimmed}" não está na lista de termos suportados por este provider.`);
        return;
      }
      value = match;
    }
    setError(null);
    if (values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <div>
      <div className={styles.chipAddRow}>
        <input
          className={styles.input}
          placeholder={restricted ? "Escolha da lista" : placeholder}
          value={draft}
          list={suggestions ? listId : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button type="button" className={styles.smallRemoveBtn} onClick={add}>
          Adicionar
        </button>
      </div>
      {error && <span className={styles.historyMeta}>{error}</span>}
      {values.length > 0 && (
        <div className={styles.chipList}>
          {values.map((v) => {
            const unsupported = restricted && !findSuggestion(v, suggestions);
            return (
              <span
                key={v}
                className={styles.chip}
                title={
                  unsupported ? "Fora da lista suportada — troque por um termo da lista" : undefined
                }
              >
                {unsupported ? `⚠ ${v}` : v}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  aria-label={`Remover ${v}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
