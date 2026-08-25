import type { PipelinesRepository } from "../PipelinesRepository";
import type { Pipeline, PipelineStage, StageKey } from "../../types/pipeline";
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
    return {
      id: key,
      label: match?.name ?? key,
      color: match?.color ?? "#9aa6b2",
      isWon: match?.is_won ?? false,
      isLost: match?.is_lost ?? false,
    };
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

  async createStage(
    pipelineId: string,
    input: Pick<PipelineStage, "label" | "color"> & { isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage> {
    const dto = await apiRequest<StageDto>(`/api/v1/pipelines/${pipelineId}/stages`, {
      method: "POST",
      body: JSON.stringify({
        name: input.label,
        color: input.color,
        is_won: input.isWon ?? false,
        is_lost: input.isLost ?? false,
      }),
    });
    return { id: "novo", label: dto.name, color: dto.color, isWon: dto.is_won, isLost: dto.is_lost };
  }

  async updateStage(
    pipelineId: string,
    stageKey: StageKey,
    input: Partial<Pick<PipelineStage, "label" | "color" | "isWon" | "isLost">>,
  ): Promise<PipelineStage> {
    // O frontend só conhece as 5 chaves fixas (`StageKey`) — o UUID real do
    // estágio fica escondido atrás de `stageKeyToId` (cache montado por
    // `toPipeline`/`buildStageMap` no último `list()`/`get()`). Repositório
    // é a camada certa pra resolver isso, não a página (ver `stageMapping.ts`).
    const stageId = stageKeyToId(pipelineId, stageKey);
    if (!stageId) {
      throw new Error("Estágio ainda não carregado — recarregue a página de Configurações.");
    }
    const dto = await apiRequest<StageDto>(`/api/v1/stages/${stageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: input.label,
        color: input.color,
        is_won: input.isWon,
        is_lost: input.isLost,
      }),
    });
    return { id: stageKey, label: dto.name, color: dto.color, isWon: dto.is_won, isLost: dto.is_lost };
  }

  async reorderStages(_pipelineId: string, orderedIds: string[]): Promise<void> {
    await apiRequest<void>("/api/v1/stages/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }
}
