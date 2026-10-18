import { IconClose } from "./Icons";
import styles from "./FilterChip.module.css";

/**
 * Chip de filtro ativo (Design System, Prompt 06). Mostra "grupo: valor" em texto (nunca só cor) e
 * um botão de remover com nome acessível ("Remover filtro Responsável: Ana").
 */
export function FilterChip({
  group,
  value,
  onRemove,
}: {
  group: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className={styles.chip}>
      <span className={styles.group}>{group}:</span>{" "}
      <span className={styles.value} title={value}>
        {value}
      </span>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={`Remover filtro ${group}: ${value}`}
      >
        <IconClose size={12} />
      </button>
    </span>
  );
}
