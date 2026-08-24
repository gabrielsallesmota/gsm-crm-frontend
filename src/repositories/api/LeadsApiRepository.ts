import type { LeadsRepository } from "../LeadsRepository";
import type {
  CreateLeadInput,
  CreateLeadMessageTemplateInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  Lead,
  LeadListFilter,
  LeadMessageTemplate,
  UpdateLeadInput,
  UpdateLeadMessageTemplateInput,
} from "../../types/lead";
import type { Page } from "../../types/common";
import type { StageKey } from "../../types/pipeline";
import { apiRequest, apiRequestText } from "./ApiClient";
import { stageIdToKey, stageKeyToId } from "./stageMapping";

interface LeadDto {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  position: string | null;
  phone: string | null;
  whatsapp: string | null;
  phone_normalized: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  pipeline_id: string;
  stage_id: string;
  // null = lead de intake público (backend Fase 6) ainda sem responsável.
  owner_id: string | null;
  expected_value: number | null;
  probability: number | null;
  origin: string;
  created_at: string;
  last_interaction_at: string | null;
}

interface MessageTemplateDto {
  id: string;
  stage_id: string;
  origin: string | null;
  message: string;
  created_at: string;
  updated_at: string;
}

function toMessageTemplate(dto: MessageTemplateDto): LeadMessageTemplate {
  return {
    id: dto.id,
    stageId: dto.stage_id,
    origin: dto.origin,
    message: dto.message,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function importRowBody(row: ImportRowInput) {
  return {
    name: row.name,
    company: row.company,
    position: row.position,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    city: row.city,
    state: row.state,
    notes: row.notes,
    origin: row.origin,
  };
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
    whatsapp: dto.whatsapp ?? "",
    phoneNormalized: dto.phone_normalized ?? "",
    stageId: dto.stage_id,
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
    if (filter.dateFrom) params.set("date_from", filter.dateFrom);
    if (filter.dateTo) params.set("date_to", filter.dateTo);
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

  async bulkImport(
    rows: ImportRowInput[],
    pipelineId: string,
    defaultStageId: string,
    defaultOwnerId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    const dto = await apiRequest<{
      total: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      rows: {
        row_index: number;
        outcome: ImportSummary["rows"][number]["outcome"];
        name: string;
        detail: string | null;
      }[];
    }>("/api/v1/leads/bulk-import", {
      method: "POST",
      body: JSON.stringify({
        pipeline_id: pipelineId,
        default_stage_id: defaultStageId,
        default_owner_id: defaultOwnerId,
        dedupe_strategy: dedupeStrategy,
        rows: rows.map(importRowBody),
      }),
    });
    return {
      total: dto.total,
      created: dto.created,
      updated: dto.updated,
      skipped: dto.skipped,
      errors: dto.errors,
      rows: dto.rows.map((r) => ({
        rowIndex: r.row_index,
        outcome: r.outcome,
        name: r.name,
        detail: r.detail,
      })),
    };
  }

  async exportCsv(): Promise<string> {
    return apiRequestText("/api/v1/leads/export");
  }

  async listMessageTemplates(): Promise<LeadMessageTemplate[]> {
    const dto = await apiRequest<MessageTemplateDto[]>("/api/v1/lead-message-templates");
    return dto.map(toMessageTemplate);
  }

  async createMessageTemplate(input: CreateLeadMessageTemplateInput): Promise<LeadMessageTemplate> {
    return toMessageTemplate(
      await apiRequest<MessageTemplateDto>("/api/v1/lead-message-templates", {
        method: "POST",
        body: JSON.stringify({
          stage_id: input.stageId,
          origin: input.origin,
          message: input.message,
        }),
      }),
    );
  }

  async updateMessageTemplate(
    id: string,
    input: UpdateLeadMessageTemplateInput,
  ): Promise<LeadMessageTemplate> {
    return toMessageTemplate(
      await apiRequest<MessageTemplateDto>(`/api/v1/lead-message-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ origin: input.origin, message: input.message }),
      }),
    );
  }

  async deleteMessageTemplate(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/lead-message-templates/${id}`, { method: "DELETE" });
  }
}
