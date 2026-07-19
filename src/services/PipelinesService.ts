import type { PipelinesRepository } from "../repositories/PipelinesRepository";
import { PipelinesApiRepository } from "../repositories/api/PipelinesApiRepository";
import { PipelinesMockRepository } from "../repositories/mock/PipelinesMockRepository";
import { CRM_MODE } from "./factory";
import type { Pipeline, PipelineStage } from "../types/pipeline";

const repo: PipelinesRepository = CRM_MODE === "demo" ? new PipelinesMockRepository() : new PipelinesApiRepository();

export class PipelinesService {
  list(): Promise<Pipeline[]> {
    return repo.list();
  }

  get(id: string): Promise<Pipeline> {
    return repo.get(id);
  }

  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline> {
    return repo.create(input);
  }

  update(id: string, input: Partial<Pick<Pipeline, "name" | "color" | "active">>): Promise<Pipeline> {
    return repo.update(id, input);
  }

  delete(id: string): Promise<void> {
    return repo.delete(id);
  }

  reorder(orderedIds: string[]): Promise<void> {
    return repo.reorder(orderedIds);
  }

  setDefault(id: string): Promise<Pipeline> {
    return repo.setDefault(id);
  }

  createStage(pipelineId: string, input: Pick<PipelineStage, "label" | "color">): Promise<PipelineStage> {
    return repo.createStage(pipelineId, input);
  }

  reorderStages(pipelineId: string, orderedIds: string[]): Promise<void> {
    return repo.reorderStages(pipelineId, orderedIds);
  }
}

export const pipelinesService = new PipelinesService();
