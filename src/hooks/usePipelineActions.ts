import { pipelinesService } from "../services/PipelinesService";
import type { Pipeline, PipelineStage, StageKey } from "../types/pipeline";

export interface PipelineActions {
  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline>;
  update(id: string, input: Partial<Pick<Pipeline, "name" | "color">>): Promise<Pipeline>;
  setDefault(id: string): Promise<Pipeline>;
  createStage(
    pipelineId: string,
    input: Pick<PipelineStage, "label" | "color"> & { isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage>;
  updateStage(
    pipelineId: string,
    stageKey: StageKey,
    input: Partial<Pick<PipelineStage, "label" | "color" | "isWon" | "isLost">>,
  ): Promise<PipelineStage>;
}

export function usePipelineActions(): PipelineActions {
  return {
    create: (input) => pipelinesService.create(input),
    update: (id, input) => pipelinesService.update(id, input),
    setDefault: (id) => pipelinesService.setDefault(id),
    createStage: (pipelineId, input) => pipelinesService.createStage(pipelineId, input),
    updateStage: (pipelineId, stageKey, input) =>
      pipelinesService.updateStage(pipelineId, stageKey, input),
  };
}
