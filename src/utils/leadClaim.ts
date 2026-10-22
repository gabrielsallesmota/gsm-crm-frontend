import type { Lead } from "../types/lead";
import type { PipelineStage } from "../types/pipeline";

/** Etapa inicial do funil: a primeira em andamento (nem ganho nem perdido). */
export function initialStageOf(stages: readonly PipelineStage[]): PipelineStage | undefined {
  return stages.find((s) => !s.isWon && !s.isLost) ?? stages[0];
}

/**
 * "Vincular a você?" — lead SEM dono indo para qualquer etapa que não seja a inicial (começar o
 * atendimento). Voltar para a inicial ou soltar na mesma etapa não pergunta.
 */
export function needsClaimPrompt(
  lead: Pick<Lead, "ownerId" | "stageId">,
  target: PipelineStage,
  initial: PipelineStage | undefined,
): boolean {
  return !lead.ownerId && target.id !== lead.stageId && target.id !== initial?.id;
}
