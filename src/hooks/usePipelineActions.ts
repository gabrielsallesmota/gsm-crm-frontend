import { pipelinesService } from "../services/PipelinesService";
import type { Pipeline, PipelineStage } from "../types/pipeline";

export interface PipelineActions {
  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline>;
  setDefault(id: string): Promise<Pipeline>;
  createStage(
    pipelineId: string,
    input: Pick<PipelineStage, "label" | "color"> & { isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage>;
}

export function usePipelineActions(): PipelineActions {
  return {
    create: (input) => pipelinesService.create(input),
    setDefault: (id) => pipelinesService.setDefault(id),
    createStage: (pipelineId, input) => pipelinesService.createStage(pipelineId, input),
  };
}
