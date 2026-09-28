import { pipelinesService } from "../services/PipelinesService";
import type { Pipeline, PipelineStage, StageInput } from "../types/pipeline";

export interface PipelineActions {
  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline>;
  update(id: string, input: Partial<Pick<Pipeline, "name" | "color">>): Promise<Pipeline>;
  delete(id: string): Promise<void>;
  setDefault(id: string): Promise<Pipeline>;
  createStage(pipelineId: string, input: StageInput): Promise<PipelineStage>;
  updateStage(stageId: string, input: Partial<StageInput>): Promise<PipelineStage>;
  deleteStage(stageId: string): Promise<void>;
  reorderStages(pipelineId: string, orderedIds: string[]): Promise<void>;
}

export function usePipelineActions(): PipelineActions {
  return {
    create: (input) => pipelinesService.create(input),
    update: (id, input) => pipelinesService.update(id, input),
    delete: (id) => pipelinesService.delete(id),
    setDefault: (id) => pipelinesService.setDefault(id),
    createStage: (pipelineId, input) => pipelinesService.createStage(pipelineId, input),
    updateStage: (stageId, input) => pipelinesService.updateStage(stageId, input),
    deleteStage: (stageId) => pipelinesService.deleteStage(stageId),
    reorderStages: (pipelineId, orderedIds) => pipelinesService.reorderStages(pipelineId, orderedIds),
  };
}
