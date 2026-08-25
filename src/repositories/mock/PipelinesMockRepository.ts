import type { PipelinesRepository } from "../PipelinesRepository";
import type { Pipeline, PipelineStage, StageKey } from "../../types/pipeline";
import { delay } from "../../utils/errors";
import { mockState } from "./state";

export class PipelinesMockRepository implements PipelinesRepository {
  async list(): Promise<Pipeline[]> {
    await delay(200);
    return mockState.pipelines.filter((p) => p.tenantId === mockState.currentTenantId);
  }

  async get(id: string): Promise<Pipeline> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === id);
    if (!pipeline) throw new Error(`Pipeline ${id} não encontrado.`);
    return pipeline;
  }

  async create(input: Pick<Pipeline, "name" | "color">): Promise<Pipeline> {
    await delay(200);
    const pipeline: Pipeline = {
      id: `p${mockState.pipelines.length + 1}`,
      tenantId: mockState.currentTenantId,
      name: input.name,
      color: input.color,
      isDefault: false,
      active: true,
      stages: [
        { id: "novo", label: "Novo", color: "#4aa3ff", isWon: false, isLost: false },
        { id: "contato", label: "Em contato", color: "#f5b13d", isWon: false, isLost: false },
        { id: "proposta", label: "Proposta", color: "#a78bfa", isWon: false, isLost: false },
        { id: "ganho", label: "Ganho", color: "#2ee66e", isWon: true, isLost: false },
        { id: "perdido", label: "Perdido", color: "#9aa6b2", isWon: false, isLost: true },
      ],
    };
    mockState.pipelines.push(pipeline);
    return pipeline;
  }

  async update(id: string, input: Partial<Pick<Pipeline, "name" | "color" | "active">>): Promise<Pipeline> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === id);
    if (!pipeline) throw new Error(`Pipeline ${id} não encontrado.`);
    Object.assign(pipeline, input);
    return pipeline;
  }

  async delete(id: string): Promise<void> {
    await delay(150);
    mockState.pipelines = mockState.pipelines.filter((p) => p.id !== id);
  }

  async reorder(orderedIds: string[]): Promise<void> {
    await delay(150);
    const byId = new Map(mockState.pipelines.map((p) => [p.id, p]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter((p): p is Pipeline => !!p);
    const rest = mockState.pipelines.filter((p) => !orderedIds.includes(p.id));
    mockState.pipelines = [...reordered, ...rest];
  }

  async setDefault(id: string): Promise<Pipeline> {
    await delay(150);
    for (const p of mockState.pipelines) {
      if (p.tenantId === mockState.currentTenantId) p.isDefault = p.id === id;
    }
    const pipeline = mockState.pipelines.find((p) => p.id === id);
    if (!pipeline) throw new Error(`Pipeline ${id} não encontrado.`);
    return pipeline;
  }

  async createStage(
    pipelineId: string,
    input: Pick<PipelineStage, "label" | "color"> & { isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado.`);
    const stage: PipelineStage = {
      id: "novo",
      label: input.label,
      color: input.color,
      isWon: input.isWon ?? false,
      isLost: input.isLost ?? false,
    };
    pipeline.stages.push(stage);
    return stage;
  }

  async updateStage(
    pipelineId: string,
    stageKey: StageKey,
    input: Partial<Pick<PipelineStage, "label" | "color" | "isWon" | "isLost">>,
  ): Promise<PipelineStage> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado.`);
    const stage = pipeline.stages.find((s) => s.id === stageKey);
    if (!stage) throw new Error(`Estágio ${stageKey} não encontrado.`);
    Object.assign(stage, input);
    return stage;
  }

  async reorderStages(pipelineId: string, orderedIds: string[]): Promise<void> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado.`);
    const byId = new Map<string, PipelineStage>(pipeline.stages.map((s) => [s.id, s]));
    pipeline.stages = orderedIds.map((id) => byId.get(id)).filter((s): s is PipelineStage => !!s);
  }
}
