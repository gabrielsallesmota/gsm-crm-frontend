import { useEffect, useRef } from "react";
import type { Pipeline, PipelineStage } from "../types/pipeline";
import { reorderIds } from "../utils/pipelineBoard";
import { usePipelineActions } from "./usePipelineActions";
import { useToast } from "./useToast";

/**
 * Reordenar as ETAPAS do pipeline (PIP-04): pelos botões do cabeçalho da coluna ("mover para a
 * esquerda/direita") ou arrastando o cabeçalho. Devolve o foco ao botão certo depois que a lista de
 * etapas é recarregada (a recarga reordena nós do DOM e pode soltar o foco).
 */
export function useStageReorder(
  pipeline: Pipeline | undefined,
  stages: PipelineStage[],
  reloadPipelines: () => void,
) {
  const { reorderStages } = usePipelineActions();
  const { toast, toastError } = useToast();
  const pendingFocus = useRef<{ stageId: string; dir: "left" | "right" } | null>(null);
  const stageOrderKey = stages.map((s) => s.id).join(",");

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    // Botão do mesmo lado — ou o oposto, se a etapa chegou à ponta e aquele foi desabilitado.
    const pick = (dir: string) =>
      document.querySelector<HTMLButtonElement>(`[data-stage-move="${target.stageId}:${dir}"]`);
    const same = pick(target.dir);
    (same && !same.disabled ? same : pick(target.dir === "left" ? "right" : "left"))?.focus();
  }, [stageOrderKey]);

  async function moveStageBy(stage: PipelineStage, dir: "left" | "right") {
    if (!pipeline) return;
    const index = stages.findIndex((s) => s.id === stage.id);
    const neighbor = stages[dir === "left" ? index - 1 : index + 1];
    if (!neighbor) return;
    const ids = reorderIds(
      stages.map((s) => s.id),
      stage.id,
      neighbor.id,
    );
    if (!ids) return;
    pendingFocus.current = { stageId: stage.id, dir };
    try {
      await reorderStages(pipeline.id, ids);
      // Mensagem completa: a posição nova é a informação que quem não enxerga o quadro precisa.
      toast(`Etapa ${stage.label} movida para a posição ${ids.indexOf(stage.id) + 1} de ${ids.length}`);
      reloadPipelines();
    } catch (err) {
      pendingFocus.current = null;
      toastError(err, "Não foi possível reordenar as etapas");
    }
  }

  /** Soltar a coluna `draggedId` sobre `target`. */
  async function dropStage(draggedId: string, target: PipelineStage) {
    if (!pipeline) return;
    const ids = reorderIds(
      stages.map((s) => s.id),
      draggedId,
      target.id,
    );
    if (!ids) return;
    try {
      await reorderStages(pipeline.id, ids);
      toast("Ordem das etapas atualizada");
      reloadPipelines();
    } catch (err) {
      toastError(err, "Não foi possível reordenar as etapas");
    }
  }

  return { moveStageBy, dropStage };
}
