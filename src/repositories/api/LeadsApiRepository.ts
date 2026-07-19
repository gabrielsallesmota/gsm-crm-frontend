import type { LeadsRepository } from "../LeadsRepository";
import type { CreateLeadInput, Lead, LeadListFilter, UpdateLeadInput } from "../../types/lead";
import type { Page } from "../../types/common";
import type { StageKey } from "../../types/pipeline";
import { apiRequest } from "./ApiClient";
import { stageIdToKey, stageKeyToId } from "./stageMapping";

interface LeadDto {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  pipeline_id: string;
  stage_id: string;
  owner_id: string;
  expected_value: number | null;
  probability: number | null;
  origin: string;
  created_at: string;
  last_interaction_at: string | null;
}

function temperatureFromProbability(p: number): Lead["temperature"] {
  if (p >= 70) return "quente";
  if (p >= 40) return "morno";
  return "frio";
}

/**
 * O backend ainda não guarda os campos "ricos" do CRM (timeline de
 * atividades, tarefas/eventos vinculados, insights de IA, sentimento,
 * objeções, campos customizados) — só o cadastro básico do lead. Essas
 * seções aparecem vazias em produção até o backend ganhar esse
 * histórico; a tela é a mesma, só o conteúdo disponível é menor.
 */
function toLead(dto: LeadDto): Lead {
  const probability = dto.probability ?? 0;
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    name: dto.name,
    company: dto.company ?? "—",
    role: dto.position ?? "",
    phone: dto.phone ?? "",
    email: dto.email ?? "",
    city: dto.city ?? "",
    state: dto.state ?? "",
    notes: dto.notes ?? "",
    stage: stageIdToKey(dto.pipeline_id, dto.stage_id),
    ownerId: dto.owner_id,
    value: dto.expected_value ?? 0,
    probability,
    origin: dto.origin,
    tags: [],
    createdAt: dto.created_at,
    firstContactHours: 0,
    lastActivityAt: dto.last_interaction_at ?? dto.created_at,
    temperature: temperatureFromProbability(probability),
    sentiment: "—",
    aiProbability: `${probability}%`,
    aiSummary: "",
    aiNext: "",
    objections: [],
    custom: {},
    timeline: [],
    tasks: [],
    events: [],
    files: [],
  };
}

export class LeadsApiRepository implements LeadsRepository {
  async list(filter: LeadListFilter): Promise<Page<Lead>> {
    const params = new URLSearchParams();
    if (filter.pipelineId) params.set("pipeline_id", filter.pipelineId);
    if (filter.pipelineId && filter.stageId) {
      const stageId = stageKeyToId(filter.pipelineId, filter.stageId as StageKey);
      if (stageId) params.set("stage_id", stageId);
    }
    if (filter.ownerId) params.set("owner_id", filter.ownerId);
    if (filter.origin) params.set("origin", filter.origin);
    if (filter.search) params.set("search", filter.search);
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 50));
    if (filter.sortBy) params.set("sort_by", filter.sortBy);
    if (filter.sortDir) params.set("sort_dir", filter.sortDir);

    const dto = await apiRequest<{ items: LeadDto[]; total: number; page: number; page_size: number }>(
      `/api/v1/leads?${params.toString()}`,
    );
    return { items: dto.items.map(toLead), total: dto.total, page: dto.page, pageSize: dto.page_size };
  }

  async get(id: string): Promise<Lead> {
    return toLead(await apiRequest<LeadDto>(`/api/v1/leads/${id}`));
  }

  async create(input: CreateLeadInput): Promise<Lead> {
    const pipelineId = input.pipelineId;
    if (!pipelineId) {
      throw new Error("Selecione um pipeline para criar o lead.");
    }
    const stageId = stageKeyToId(pipelineId, input.stage ?? "novo");
    if (!stageId) {
      throw new Error("Estágio do pipeline ainda não carregado — abra a tela de Pipeline antes de criar o lead.");
    }
    const dto = await apiRequest<LeadDto>("/api/v1/leads", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        company: input.company,
        phone: input.phone,
        email: input.email,
        notes: input.notes ?? null,
        pipeline_id: pipelineId,
        stage_id: stageId,
        owner_id: input.ownerId,
        origin: input.origin,
        expected_value: input.value,
      }),
    });
    return toLead(dto);
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    const dto = await apiRequest<LeadDto>(`/api/v1/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: input.name,
        company: input.company,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
        expected_value: input.value,
        probability: input.probability,
      }),
    });
    return toLead(dto);
  }

  async move(id: string, stage: StageKey): Promise<Lead> {
    const current = await apiRequest<LeadDto>(`/api/v1/leads/${id}`);
    const stageId = stageKeyToId(current.pipeline_id, stage);
    if (!stageId) {
      throw new Error("Estágio do pipeline ainda não carregado — abra a tela de Pipeline antes de mover o lead.");
    }
    const moved = await apiRequest<LeadDto>(`/api/v1/leads/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ stage_id: stageId }),
    });
    return toLead(moved);
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/leads/${id}`, { method: "DELETE" });
  }
}
