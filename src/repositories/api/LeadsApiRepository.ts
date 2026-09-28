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
  LeadTimelineItem,
  UpdateLeadInput,
  UpdateLeadMessageTemplateInput,
} from "../../types/lead";
import type { Page } from "../../types/common";
import { apiRequest, apiRequestText } from "./ApiClient";

interface StageDto {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
}

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
  updated_at: string;
  last_interaction_at: string | null;
  tags: string[];
  last_comment: { text: string; created_at: string } | null;
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

interface TimelineItemDto {
  id: string;
  type: string;
  created_at: string;
  actor_type: string;
  actor_name: string | null;
  payload: Record<string, unknown>;
  text: string | null;
}

function toLead(dto: LeadDto): Lead {
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    name: dto.name,
    company: dto.company ?? "",
    role: dto.position ?? "",
    phone: dto.phone ?? "",
    whatsapp: dto.whatsapp ?? "",
    phoneNormalized: dto.phone_normalized ?? "",
    email: dto.email ?? "",
    city: dto.city ?? "",
    state: dto.state ?? "",
    notes: dto.notes ?? "",
    pipelineId: dto.pipeline_id,
    stageId: dto.stage_id,
    ownerId: dto.owner_id,
    value: dto.expected_value ?? 0,
    probability: dto.probability ?? 0,
    origin: dto.origin,
    tags: dto.tags,
    lastComment: dto.last_comment
      ? { text: dto.last_comment.text, createdAt: dto.last_comment.created_at }
      : null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    lastInteractionAt: dto.last_interaction_at,
  };
}

export class LeadsApiRepository implements LeadsRepository {
  async list(filter: LeadListFilter): Promise<Page<Lead>> {
    const params = new URLSearchParams();
    if (filter.pipelineId) params.set("pipeline_id", filter.pipelineId);
    if (filter.stageId) params.set("stage_id", filter.stageId);
    if (filter.ownerId) params.set("owner_id", filter.ownerId);
    else if (filter.unassigned) params.set("unassigned", "true");
    if (filter.tagId) params.set("tag_id", filter.tagId);
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
    let stageId = input.stageId;
    if (!stageId) {
      // Form rápido não escolhe etapa: usa a primeira etapa EM ANDAMENTO do
      // pipeline (mesmo critério do intake público do backend).
      const pipeline = await apiRequest<{ stages: StageDto[] }>(`/api/v1/pipelines/${pipelineId}`);
      const intake = [...pipeline.stages]
        .filter((st) => !st.is_won && !st.is_lost)
        .sort((x, y) => x.order - y.order)[0];
      if (!intake) {
        throw new Error(
          "Esse pipeline não tem nenhuma etapa em andamento — crie uma etapa em Configurações antes de cadastrar um lead.",
        );
      }
      stageId = intake.id;
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
        origin: input.origin,
        owner_id: input.ownerId,
        // `undefined` (campo omitido) faz o backend não mexer nas tags —
        // só envia `tag_ids` quando `input.tags` de fato veio preenchido.
        tag_ids: input.tags,
      }),
    });
    return toLead(dto);
  }

  async move(id: string, stageId: string): Promise<Lead> {
    const moved = await apiRequest<LeadDto>(`/api/v1/leads/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ stage_id: stageId }),
    });
    return toLead(moved);
  }

  async timeline(id: string): Promise<LeadTimelineItem[]> {
    const items = await apiRequest<TimelineItemDto[]>(`/api/v1/leads/${id}/timeline`);
    return items.map((i) => ({
      id: i.id,
      type: i.type,
      createdAt: i.created_at,
      actorType: i.actor_type,
      actorName: i.actor_name,
      payload: i.payload,
      text: i.text,
    }));
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
