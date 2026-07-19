import type { PipelinesRepository } from "../PipelinesRepository";
import type { Pipeline, PipelineStage } from "../../types/pipeline";
import { STAGE_ORDER } from "../../constants/stages";
import { apiRequest } from "./ApiClient";
import { buildStageMap, stageKeyToId, type RemoteStage } from "./stageMapping";

interface PipelineDto {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  order: number;
  is_default: boolean;
}

interface StageDto {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
}

function toRemoteStage(dto: StageDto): RemoteStage {
  return { id: dto.id, name: dto.name, color: dto.color, order: dto.order, isWon: dto.is_won, isLost: dto.is_lost };
}

async function toPipeline(dto: PipelineDto): Promise<Pipeline> {
  const stageDtos = await apiRequest<StageDto[]>(`/api/v1/pipelines/${dto.id}/stages`);
  buildStageMap(dto.id, stageDtos.map(toRemoteStage));
  const byId = new Map(stageDtos.map((s) => [s.id, s]));
  const stages: PipelineStage[] = STAGE_ORDER.map((key) => {
    const remoteId = stageKeyToId(dto.id, key);
    const match = remoteId ? byId.get(remoteId) : undefined;
    return { id: key, label: match?.name ?? key, color: match?.color ?? "#9aa6b2" };
  });
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    name: dto.name,
    color: dto.color,
    isDefault: dto.is_default,
    active: true,
    stages,
  };
}

export class PipelinesApiRepository implements PipelinesRepository {
  async list(): Promise<Pipeline[]> {
    const dtos = await apiRequest<PipelineDto[]>("/api/v1/pipelines");
    return Promise.all(dtos.map(toPipeline));
  }

  async get(id: string): Promise<Pipeline> {
    const dto = await apiRequest<PipelineDto>(`/api/v1/pipelines/${id}`);
    return toPipeline(dto);
  }

  async create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline> {
    const dto = await apiRequest<PipelineDto>("/api/v1/pipelines", {
      method: "POST",
      body: JSON.stringify({ name: input.name, color: input.color }),
    });
    return toPipeline(dto);
  }

  async update(id: string, input: Partial<Pick<Pipeline, "name" | "color">>): Promise<Pipeline> {
    const dto = await apiRequest<PipelineDto>(`/api/v1/pipelines/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: input.name, color: input.color }),
    });
    return toPipeline(dto);
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
    const dto = await apiRequest<PipelineDto>(`/api/v1/pipelines/${id}/default`, { method: "POST" });
    return toPipeline(dto);
  }

  async createStage(pipelineId: string, input: Pick<PipelineStage, "label" | "color">): Promise<PipelineStage> {
    const dto = await apiRequest<StageDto>(`/api/v1/pipelines/${pipelineId}/stages`, {
      method: "POST",
      body: JSON.stringify({ name: input.label, color: input.color }),
    });
    return { id: "novo", label: dto.name, color: dto.color };
  }

  async reorderStages(_pipelineId: string, orderedIds: string[]): Promise<void> {
    await apiRequest<void>("/api/v1/stages/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }
}
