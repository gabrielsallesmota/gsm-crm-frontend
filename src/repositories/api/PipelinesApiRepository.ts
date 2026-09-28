import type { PipelinesRepository } from "../PipelinesRepository";
import type { Pipeline, PipelineStage, StageInput } from "../../types/pipeline";
import { sortStages } from "../../types/pipeline";
import { apiRequest } from "./ApiClient";

interface StageDto {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
}

interface PipelineDto {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  order: number;
  is_default: boolean;
  /** `GET /pipelines` e `GET /pipelines/{id}` já trazem as etapas reais. */
  stages?: StageDto[];
}

/** Etapa exatamente como o backend define — sem nenhum mapeamento para um
 * funil fixo (o antigo `stageMapping.ts` foi removido na Etapa 1). */
export function toStage(dto: StageDto): PipelineStage {
  return {
    id: dto.id,
    label: dto.name,
    color: dto.color,
    order: dto.order,
    isWon: dto.is_won,
    isLost: dto.is_lost,
  };
}

function toPipeline(dto: PipelineDto): Pipeline {
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    name: dto.name,
    color: dto.color,
    isDefault: dto.is_default,
    active: true,
    stages: sortStages((dto.stages ?? []).map(toStage)),
  };
}

function stageBody(input: Partial<StageInput>) {
  return {
    name: input.label,
    color: input.color,
    is_won: input.isWon,
    is_lost: input.isLost,
  };
}

export class PipelinesApiRepository implements PipelinesRepository {
  async list(): Promise<Pipeline[]> {
    const dtos = await apiRequest<PipelineDto[]>("/api/v1/pipelines");
    return dtos.map(toPipeline);
  }

  async get(id: string): Promise<Pipeline> {
    return toPipeline(await apiRequest<PipelineDto>(`/api/v1/pipelines/${id}`));
  }

  async create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline> {
    const dto = await apiRequest<PipelineDto>("/api/v1/pipelines", {
      method: "POST",
      body: JSON.stringify({ name: input.name, color: input.color }),
    });
    return toPipeline(dto);
  }

  async update(id: string, input: Partial<Pick<Pipeline, "name" | "color">>): Promise<Pipeline> {
    await apiRequest<PipelineDto>(`/api/v1/pipelines/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: input.name, color: input.color }),
    });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/pipelines/${id}`, { method: "DELETE" });
  }

  async reorder(orderedIds: string[]): Promise<void> {
    await apiRequest<void>("/api/v1/pipelines/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }

  async setDefault(id: string): Promise<Pipeline> {
    await apiRequest<PipelineDto>(`/api/v1/pipelines/${id}/default`, { method: "POST" });
    return this.get(id);
  }

  async createStage(pipelineId: string, input: StageInput): Promise<PipelineStage> {
    const dto = await apiRequest<StageDto>(`/api/v1/pipelines/${pipelineId}/stages`, {
      method: "POST",
      body: JSON.stringify({ ...stageBody(input), is_won: !!input.isWon, is_lost: !!input.isLost }),
    });
    return toStage(dto);
  }

  async updateStage(stageId: string, input: Partial<StageInput>): Promise<PipelineStage> {
    const dto = await apiRequest<StageDto>(`/api/v1/stages/${stageId}`, {
      method: "PATCH",
      body: JSON.stringify(stageBody(input)),
    });
    return toStage(dto);
  }

  async deleteStage(stageId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/stages/${stageId}`, { method: "DELETE" });
  }

  async reorderStages(_pipelineId: string, orderedIds: string[]): Promise<void> {
    await apiRequest<void>("/api/v1/stages/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }
}
