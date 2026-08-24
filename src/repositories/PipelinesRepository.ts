import type { Pipeline, PipelineStage } from "../types/pipeline";

export interface PipelinesRepository {
  list(): Promise<Pipeline[]>;
  get(id: string): Promise<Pipeline>;
  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline>;
  update(id: string, input: Partial<Pick<Pipeline, "name" | "color" | "active">>): Promise<Pipeline>;
  delete(id: string): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
  setDefault(id: string): Promise<Pipeline>;
  createStage(
    pipelineId: string,
    input: Pick<PipelineStage, "label" | "color"> & { isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage>;
  reorderStages(pipelineId: string, orderedIds: string[]): Promise<void>;
}
