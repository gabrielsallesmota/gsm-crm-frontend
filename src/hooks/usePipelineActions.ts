import { pipelinesService } from "../services/PipelinesService";
import type { Pipeline } from "../types/pipeline";

export interface PipelineActions {
  create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline>;
  setDefault(id: string): Promise<Pipeline>;
}

export function usePipelineActions(): PipelineActions {
  return {
    create: (input) => pipelinesService.create(input),
    setDefault: (id) => pipelinesService.setDefault(id),
  };
}
