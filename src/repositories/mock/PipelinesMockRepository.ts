import type { PipelinesRepository } from "../PipelinesRepository";
import type { Pipeline, PipelineStage, StageInput } from "../../types/pipeline";
import { delay } from "../../utils/errors";
import { mockState } from "./state";

let stageSeq = 1000;

function findStage(stageId: string): { pipeline: Pipeline; stage: PipelineStage } {
  for (const pipeline of mockState.pipelines) {
    const stage = pipeline.stages.find((s) => s.id === stageId);
    if (stage) return { pipeline, stage };
  }
  throw new Error(`Etapa ${stageId} não encontrada.`);
}

function renumber(pipeline: Pipeline): void {
  pipeline.stages.forEach((s, index) => {
    s.order = index;
  });
}

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
    const id = `p${mockState.pipelines.length + 1}`;
    const defaults: [string, string, boolean, boolean][] = [
      ["Novo", "#4aa3ff", false, false],
      ["Em contato", "#f5b13d", false, false],
      ["Proposta", "#a78bfa", false, false],
      ["Ganho", "#2ee66e", true, false],
      ["Perdido", "#9aa6b2", false, true],
    ];
    const pipeline: Pipeline = {
      id,
      tenantId: mockState.currentTenantId,
      name: input.name,
      color: input.color,
      isDefault: false,
      active: true,
      stages: defaults.map(([label, color, isWon, isLost], order) => ({
        id: `${id}-s${stageSeq++}`,
        label,
        color,
        order,
        isWon,
        isLost,
      })),
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
    if (mockState.leads.some((l) => l.pipelineId === id)) {
      throw new Error("Este pipeline ainda tem leads.");
    }
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
    return this.get(id);
  }

  async createStage(pipelineId: string, input: StageInput): Promise<PipelineStage> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado.`);
    if (input.isWon && input.isLost) throw new Error("Uma etapa não pode ser de ganho e de perda ao mesmo tempo.");
    const stage: PipelineStage = {
      id: `${pipelineId}-s${stageSeq++}`,
      label: input.label,
      color: input.color,
      order: pipeline.stages.length,
      isWon: input.isWon ?? false,
      isLost: input.isLost ?? false,
    };
    pipeline.stages.push(stage);
    return stage;
  }

  async updateStage(stageId: string, input: Partial<StageInput>): Promise<PipelineStage> {
    await delay(150);
    const { stage } = findStage(stageId);
    const isWon = input.isWon ?? stage.isWon;
    const isLost = input.isLost ?? stage.isLost;
    if (isWon && isLost) throw new Error("Uma etapa não pode ser de ganho e de perda ao mesmo tempo.");
    Object.assign(stage, input);
    return stage;
  }

  async deleteStage(stageId: string): Promise<void> {
    await delay(150);
    const { pipeline } = findStage(stageId);
    if (mockState.leads.some((l) => l.stageId === stageId)) {
      throw new Error("Esta etapa ainda tem leads. Mova os leads antes de excluí-la.");
    }
    pipeline.stages = pipeline.stages.filter((s) => s.id !== stageId);
    renumber(pipeline);
  }

  async reorderStages(pipelineId: string, orderedIds: string[]): Promise<void> {
    await delay(150);
    const pipeline = mockState.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado.`);
    const byId = new Map<string, PipelineStage>(pipeline.stages.map((s) => [s.id, s]));
    pipeline.stages = orderedIds.map((id) => byId.get(id)).filter((s): s is PipelineStage => !!s);
    renumber(pipeline);
  }
}
