import { useCallback, useRef, useState, type DragEvent } from "react";
import type { PipelineStage } from "../types/pipeline";

/**
 * Estado do arrastar do quadro (HTML5): qual CARTÃO ou qual COLUNA está sendo arrastado e sobre qual
 * coluna está o ponteiro. Os callbacks são ESTÁVEIS (`useCallback` + ref) — os cartões são `memo` e
 * não podem ser redesenhados a cada realce de destino.
 */
export function usePipelineDrag(handlers: {
  moveLead: (leadId: string, stage: PipelineStage) => Promise<void>;
  dropStage: (draggedId: string, target: PipelineStage) => Promise<void>;
  stages: PipelineStage[];
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  // Arrastar uma COLUNA (reordenar etapas) é diferente de arrastar um CARD (mover lead de etapa).
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const latest = useRef(handlers);
  latest.current = handlers;

  const startCardDrag = useCallback((id: string) => setDragId(id), []);
  const endDrag = useCallback(() => {
    // Também roda quando o arraste é CANCELADO (Esc / soltar fora): sem isto o estado ficava preso e
    // um "soltar" posterior (ex.: um arquivo) moveria o lead antigo.
    setDragId(null);
    setDragColumnId(null);
    setOverStageId(null);
  }, []);
  const moveLeadToStage = useCallback((leadId: string, stageId: string) => {
    const target = latest.current.stages.find((s) => s.id === stageId);
    if (target) void latest.current.moveLead(leadId, target);
  }, []);
  const enterColumn = useCallback((stageId: string) => setOverStageId(stageId), []);
  const leaveColumn = useCallback((stageId: string, event: DragEvent<HTMLDivElement>) => {
    // `relatedTarget` vem nulo no Chromium durante arraste: decide pela POSIÇÃO do ponteiro. Sair de um
    // filho para outro filho da mesma coluna continua "dentro" (não pisca o realce).
    const box = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX > box.left && event.clientX < box.right && event.clientY > box.top && event.clientY < box.bottom;
    if (inside) return;
    setOverStageId((current) => (current === stageId ? null : current));
  }, []);

  async function drop(target: PipelineStage) {
    setOverStageId(null);
    if (dragColumnId) {
      const draggedStageId = dragColumnId;
      setDragColumnId(null);
      await handlers.dropStage(draggedStageId, target);
      return;
    }
    if (!dragId) return;
    const leadId = dragId;
    setDragId(null);
    await handlers.moveLead(leadId, target);
  }

  return {
    dragId,
    dragColumnId,
    overStageId,
    startCardDrag,
    startColumnDrag: setDragColumnId,
    endDrag,
    moveLeadToStage,
    enterColumn,
    leaveColumn,
    drop,
  };
}
