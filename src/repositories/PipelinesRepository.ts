import type { Pipeline, PipelineStage, StageInput } from "../types/pipeline";

export interface PipelinesRepository {
  /** Cada pipeline já vem com as etapas reais, ordenadas. */
  list(): Promise<Pipeline[]>;
  get(id: string): Promise<Pipeline>;
  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline>;
  update(id: string, input: Partial<Pick<Pipeline, "name" | "color" | "active">>): Promise<Pipeline>;
  delete(id: string): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
  setDefault(id: string): Promise<Pipeline>;
  createStage(pipelineId: string, input: StageInput): Promise<PipelineStage>;
  updateStage(stageId: string, input: Partial<StageInput>): Promise<PipelineStage>;
  deleteStage(stageId: string): Promise<void>;
  reorderStages(pipelineId: string, orderedIds: string[]): Promise<void>;
}
