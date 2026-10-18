import type { PipelineStage } from "../../types/pipeline";
import type { BoardState } from "../../utils/pipelineBoard";
import styles from "./StageTabs.module.css";

/**
 * Navegação entre etapas no CELULAR (Prompt 06): em vez de espremer todas as colunas na largura da
 * tela, mostra uma etapa por vez e este seletor troca qual. Em telas largas fica oculto (todas as
 * colunas aparecem). Cada botão informa a etapa e o total REAL de leads dela.
 */
export function StageTabs({
  stages,
  board,
  activeId,
  onSelect,
}: {
  stages: PipelineStage[];
  board: BoardState;
  activeId: string;
  onSelect: (stageId: string) => void;
}) {
  return (
    <div className={styles.tabs} role="group" aria-label="Escolher etapa">
      {stages.map((stage) => {
        const column = board[stage.id];
        const total = column && column.page > 0 ? column.total : null;
        const active = stage.id === activeId;
        return (
          <button
            key={stage.id}
            type="button"
            className={active ? `${styles.tab} ${styles.active}` : styles.tab}
            aria-pressed={active}
            onClick={() => onSelect(stage.id)}
          >
            <span className={styles.dot} style={{ background: stage.color }} aria-hidden="true" />
            <span className={styles.name}>{stage.label}</span>
            <span className={styles.count}>{total ?? "…"}</span>
          </button>
        );
      })}
    </div>
  );
}
