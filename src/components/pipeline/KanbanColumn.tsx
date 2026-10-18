import { useId, type DragEvent, type ReactNode } from "react";
import type { PipelineStage } from "../../types/pipeline";
import { brl } from "../../utils/currency";
import { hasMore, type BoardColumn } from "../../utils/pipelineBoard";
import { columnValue } from "../../utils/pipelineView";
import { IconChevronLeft, IconChevronRight } from "../common/Icons";
import styles from "./KanbanColumn.module.css";

export interface KanbanColumnProps {
  stage: PipelineStage;
  column: BoardColumn | undefined;
  /** Cartões já renderizados pela página (mantém o `memo` dos cartões). */
  children: ReactNode;
  isFirst: boolean;
  isLast: boolean;
  /** `pipeline.reorder`: mostra reordenar (setas) e deixa arrastar o cabeçalho. */
  canReorder: boolean;
  /** Mobile: só a coluna ativa aparece (a troca é pelo seletor de etapas). */
  mobileActive: boolean;
  /** Um cartão está sendo arrastado sobre esta coluna. */
  cardOver: boolean;
  /** Um cartão está sendo arrastado (em qualquer lugar). */
  cardDragging: boolean;
  /** Uma COLUNA está sendo arrastada sobre esta. */
  columnOver: boolean;
  /** Esta coluna é a arrastada. */
  columnDragged: boolean;
  onMoveStage: (stage: PipelineStage, dir: "left" | "right") => void;
  onLoadMore: (stageId: string) => void;
  onRetry: () => void;
  onHeaderDragStart: (stageId: string) => void;
  onHeaderDragEnd: () => void;
  onDragEnter: (stageId: string) => void;
  onDragLeave: (stageId: string, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (stage: PipelineStage) => void;
}

export function KanbanColumn({
  stage,
  column,
  children,
  isFirst,
  isLast,
  canReorder,
  mobileActive,
  cardOver,
  cardDragging,
  columnOver,
  columnDragged,
  onMoveStage,
  onLoadMore,
  onRetry,
  onHeaderDragStart,
  onHeaderDragEnd,
  onDragEnter,
  onDragLeave,
  onDrop,
}: KanbanColumnProps) {
  const labelId = useId();
  const loaded = !!column && column.page > 0;
  const sum = columnValue(column);
  const hasCards = (column?.items.length ?? 0) > 0;
  const classes = [
    styles.column,
    cardOver ? styles.cardOver : "",
    columnOver ? styles.columnOver : "",
    columnDragged ? styles.columnDragged : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="group"
      aria-labelledby={labelId}
      data-stage-column
      data-stage-id={stage.id}
      data-stage-name={stage.label}
      data-mobile-active={mobileActive}
      onDragOver={(e) => {
        e.preventDefault(); // aceita o soltar
        onDragEnter(stage.id); // idempotente (mesmo valor = sem re-render); resiste a dragenter perdido
      }}
      onDragEnter={() => onDragEnter(stage.id)}
      onDragLeave={(e) => onDragLeave(stage.id, e)}
      onDrop={() => onDrop(stage)}
    >
      <div
        className={styles.header}
        data-stage-header
        draggable={canReorder}
        onDragStart={(e) => {
          if (!canReorder) return;
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", stage.id);
          }
          onHeaderDragStart(stage.id);
        }}
        onDragEnd={onHeaderDragEnd}
        title={canReorder ? "Arraste para reordenar as etapas" : undefined}
      >
        <span className={styles.dot} style={{ background: stage.color }} aria-hidden="true" />
        <span id={labelId} className={styles.label}>
          {stage.label}
          {stage.isWon ? " 🏆" : stage.isLost ? " ✕" : ""}
        </span>
        {(stage.isWon || stage.isLost) && (
          <span className="sr-only">{stage.isWon ? "etapa de ganho" : "etapa de perda"}</span>
        )}
        {sum !== null && sum > 0 && (
          <span className={styles.sum} title="Soma dos valores (todos os leads desta etapa estão carregados)">
            R$ {brl(sum)}
          </span>
        )}
        <span className={styles.count} data-stage-count title="Total real nesta etapa">
          {loaded ? column.total : "…"}
        </span>
        {canReorder && (
          <span className={styles.moves}>
            <button
              type="button"
              className={styles.moveBtn}
              data-stage-move={`${stage.id}:left`}
              aria-label={`Mover etapa ${stage.label} para a esquerda`}
              disabled={isFirst}
              onClick={() => onMoveStage(stage, "left")}
            >
              <IconChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={styles.moveBtn}
              data-stage-move={`${stage.id}:right`}
              aria-label={`Mover etapa ${stage.label} para a direita`}
              disabled={isLast}
              onClick={() => onMoveStage(stage, "right")}
            >
              <IconChevronRight size={14} />
            </button>
          </span>
        )}
      </div>

      <div className={styles.body}>
        {cardOver && (
          <div className={styles.dropHint} aria-hidden="true">
            Soltar aqui
          </div>
        )}
        {children}
        {column?.error && (
          <div className={styles.error} role="alert">
            {column.error}{" "}
            <button type="button" className={styles.linkBtn} onClick={onRetry}>
              Tentar de novo
            </button>
          </div>
        )}
        {column?.loading && !hasCards && (
          <div role="status" aria-live="polite">
            <span className="sr-only">Carregando…</span>
            <div className={styles.skeletons} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.skeletonCard}>
                  <span className={styles.skeletonLine} style={{ width: `${72 - i * 10}%` }} />
                  <span className={styles.skeletonLineShort} />
                </div>
              ))}
            </div>
          </div>
        )}
        {column?.loading && hasCards && (
          <div className={styles.loadingMore} role="status">
            Carregando…
          </div>
        )}
        {column && !column.loading && !column.error && !hasCards && (
          <div className={styles.empty}>
            <span>Sem leads</span>
            {/* Espaço SEMPRE reservado: trocar a altura da coluna durante o arraste tira o ponteiro do
                alvo e o navegador cancela o soltar. */}
            <span className={styles.emptyHint} data-active={cardDragging}>
              Solte aqui para mover
            </span>
          </div>
        )}
        {column && !column.loading && hasMore(column) && (
          <button type="button" className={styles.loadMore} onClick={() => onLoadMore(stage.id)}>
            Carregar mais ({column.total - column.items.length})
          </button>
        )}
      </div>
    </div>
  );
}
