import type { ProspectsRepository } from "../ProspectsRepository";
import type {
  CreateMessageTemplateInput,
  CreateProspectInput,
  CreateProspectLossReasonInput,
  CreateProspectStageInput,
  DedupeStrategy,
  ImportRowInput,
  ImportSummary,
  MessageTemplate,
  PageObjective,
  PhoneType,
  Prospect,
  ProspectDashboardMetrics,
  ProspectDuplicateCheck,
  ProspectListFilter,
  ProspectLossReason,
  ProspectMessageField,
  ProspectOrigin,
  ProspectPriority,
  ProspectStage,
  SiteStatus,
  UpdateMessageTemplateInput,
  UpdateProspectInput,
  UpdateProspectLossReasonInput,
  UpdateProspectStageInput,
  WhatsappStatus,
} from "../../types/prospect";
import type { Page } from "../../types/common";
import type { Period } from "../../utils/periods";
import { apiRequest, apiRequestText } from "./ApiClient";

interface ProspectDto {
  id: string;
  sequence_number: number;
  stage_id: string;
  company_name: string;
  niche: string | null;
  main_service: string | null;
  city: string | null;
  neighborhood: string | null;
  google_maps_url: string | null;
  phone_raw: string | null;
  phone_normalized: string | null;
  phone_type: PhoneType;
  whatsapp_status: WhatsappStatus;
  website_url: string | null;
  site_status: SiteStatus;
  instagram: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  positive_note: string | null;
  opportunity: string | null;
  page_objective: PageObjective | null;
  priority: ProspectPriority;
  origin: ProspectOrigin;
  offered_service: string | null;
  no_whatsapp: boolean;
  loss_reason_id: string | null;
  message_1: string | null;
  message_2: string | null;
  message_3: string | null;
  message_4: string | null;
  initial_contact_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  last_comment: { text: string; created_at: string } | null;
}

interface ProspectStageDto {
  id: string;
  name: string;
  color: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
  asks_target_date: boolean;
  followup_business_days: number | null;
  message_field: ProspectMessageField | null;
}

function toProspect(dto: ProspectDto): Prospect {
  return {
    id: dto.id,
    sequenceNumber: dto.sequence_number,
    stageId: dto.stage_id,
    companyName: dto.company_name,
    niche: dto.niche ?? "",
    mainService: dto.main_service ?? "",
    city: dto.city ?? "",
    neighborhood: dto.neighborhood ?? "",
    googleMapsUrl: dto.google_maps_url ?? "",
    phoneRaw: dto.phone_raw ?? "",
    phoneNormalized: dto.phone_normalized ?? "",
    phoneType: dto.phone_type,
    whatsappStatus: dto.whatsapp_status,
    websiteUrl: dto.website_url ?? "",
    siteStatus: dto.site_status,
    instagram: dto.instagram ?? "",
    googleRating: dto.google_rating,
    googleReviewsCount: dto.google_reviews_count,
    positiveNote: dto.positive_note ?? "",
    opportunity: dto.opportunity ?? "",
    pageObjective: dto.page_objective,
    priority: dto.priority,
    origin: dto.origin,
    offeredService: dto.offered_service ?? "",
    noWhatsapp: dto.no_whatsapp,
    lossReasonId: dto.loss_reason_id,
    message1: dto.message_1 ?? "",
    message2: dto.message_2 ?? "",
    message3: dto.message_3 ?? "",
    message4: dto.message_4 ?? "",
    initialContactDate: dto.initial_contact_date,
    targetDate: dto.target_date,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    lastComment: dto.last_comment
      ? { text: dto.last_comment.text, createdAt: dto.last_comment.created_at }
      : null,
  };
}

function toProspectStage(dto: ProspectStageDto): ProspectStage {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color,
    order: dto.order,
    isWon: dto.is_won,
    isLost: dto.is_lost,
    asksTargetDate: dto.asks_target_date,
    followupBusinessDays: dto.followup_business_days,
    messageField: dto.message_field,
  };
}

function createBody(input: CreateProspectInput | UpdateProspectInput) {
  return {
    stage_id: "stageId" in input ? input.stageId : undefined,
    company_name: input.companyName,
    niche: input.niche,
    main_service: input.mainService,
    city: input.city,
    neighborhood: input.neighborhood,
    google_maps_url: input.googleMapsUrl,
    phone_raw: input.phoneRaw,
    phone_type: input.phoneType,
    whatsapp_status: input.whatsappStatus,
    website_url: input.websiteUrl,
    site_status: input.siteStatus,
    instagram: input.instagram,
    google_rating: input.googleRating,
    google_reviews_count: input.googleReviewsCount,
    positive_note: input.positiveNote,
    opportunity: input.opportunity,
    page_objective: input.pageObjective,
    priority: input.priority,
    origin: input.origin,
    offered_service: input.offeredService,
    no_whatsapp: input.noWhatsapp,
    loss_reason_id: input.lossReasonId,
    message_1: input.message1,
    message_2: input.message2,
    message_3: input.message3,
    message_4: input.message4,
    initial_contact_date: input.initialContactDate,
    target_date: input.targetDate,
    force: input.force ?? false,
  };
}

function importRowBody(row: ImportRowInput) {
  return {
    company_name: row.companyName,
    niche: row.niche,
    main_service: row.mainService,
    city: row.city,
    neighborhood: row.neighborhood,
    google_maps_url: row.googleMapsUrl,
    phone_raw: row.phoneRaw,
    phone_type: row.phoneType,
    whatsapp_status: row.whatsappStatus,
    website_url: row.websiteUrl,
    site_status: row.siteStatus,
    instagram: row.instagram,
    google_rating: row.googleRating,
    google_reviews_count: row.googleReviewsCount,
    positive_note: row.positiveNote,
    opportunity: row.opportunity,
    page_objective: row.pageObjective,
    priority: row.priority,
    origin: row.origin,
    offered_service: row.offeredService,
    no_whatsapp: row.noWhatsapp,
    message_1: row.message1,
    message_2: row.message2,
    message_3: row.message3,
    message_4: row.message4,
    initial_contact_date: row.initialContactDate,
  };
}

export class ProspectsApiRepository implements ProspectsRepository {
  async list(filter: ProspectListFilter): Promise<Page<Prospect>> {
    const params = new URLSearchParams();
    if (filter.stageId) params.set("stage_id", filter.stageId);
    if (filter.priority) params.set("priority", filter.priority);
    if (filter.pageObjective) params.set("page_objective", filter.pageObjective);
    if (filter.origin) params.set("origin", filter.origin);
    if (filter.search) params.set("search", filter.search);
    if (filter.dateFrom) params.set("date_from", filter.dateFrom);
    if (filter.dateTo) params.set("date_to", filter.dateTo);
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 100));

    const dto = await apiRequest<{
      items: ProspectDto[];
      total: number;
      page: number;
      page_size: number;
    }>(`/api/v1/prospects?${params.toString()}`);
    return {
      items: dto.items.map(toProspect),
      total: dto.total,
      page: dto.page,
      pageSize: dto.page_size,
    };
  }

  async get(id: string): Promise<Prospect> {
    return toProspect(await apiRequest<ProspectDto>(`/api/v1/prospects/${id}`));
  }

  async create(input: CreateProspectInput): Promise<Prospect> {
    return toProspect(
      await apiRequest<ProspectDto>("/api/v1/prospects", {
        method: "POST",
        body: JSON.stringify(createBody(input)),
      }),
    );
  }

  async update(id: string, input: UpdateProspectInput): Promise<Prospect> {
    return toProspect(
      await apiRequest<ProspectDto>(`/api/v1/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(createBody(input)),
      }),
    );
  }

  async move(
    id: string,
    stageId: string,
    targetDate?: string | null,
    lossReasonId?: string | null,
  ): Promise<Prospect> {
    return toProspect(
      await apiRequest<ProspectDto>(`/api/v1/prospects/${id}/move`, {
        method: "PATCH",
        body: JSON.stringify({
          stage_id: stageId,
          target_date: targetDate ?? null,
          loss_reason_id: lossReasonId ?? null,
        }),
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/prospects/${id}`, { method: "DELETE" });
  }

  async checkDuplicate(phone: string): Promise<ProspectDuplicateCheck> {
    const dto = await apiRequest<{ exists: boolean; prospect: ProspectDto | null }>(
      `/api/v1/prospects/check-duplicate?${new URLSearchParams({ phone }).toString()}`,
    );
    return { exists: dto.exists, prospect: dto.prospect ? toProspect(dto.prospect) : null };
  }

  async bulkImport(
    rows: ImportRowInput[],
    defaultStageId: string,
    dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    const dto = await apiRequest<{
      total: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      rows: { row_index: number; outcome: ImportSummary["rows"][number]["outcome"]; company_name: string; detail: string | null }[];
    }>("/api/v1/prospects/bulk-import", {
      method: "POST",
      body: JSON.stringify({
        default_stage_id: defaultStageId,
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
        companyName: r.company_name,
        detail: r.detail,
      })),
    };
  }

  async exportCsv(): Promise<string> {
    return apiRequestText("/api/v1/prospects/export");
  }

  async backfillCadence(): Promise<number> {
    const dto = await apiRequest<{ updated: number }>("/api/v1/prospects/backfill-cadence", {
      method: "POST",
    });
    return dto.updated;
  }

  async listStages(): Promise<ProspectStage[]> {
    const dto = await apiRequest<ProspectStageDto[]>("/api/v1/prospect-stages");
    return dto.map(toProspectStage);
  }

  async createStage(input: CreateProspectStageInput): Promise<ProspectStage> {
    return toProspectStage(
      await apiRequest<ProspectStageDto>("/api/v1/prospect-stages", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          color: input.color,
          is_won: input.isWon ?? false,
          is_lost: input.isLost ?? false,
          asks_target_date: input.asksTargetDate ?? false,
          followup_business_days: input.followupBusinessDays ?? null,
          message_field: input.messageField ?? null,
        }),
      }),
    );
  }

  async updateStage(id: string, input: UpdateProspectStageInput): Promise<ProspectStage> {
    return toProspectStage(
      await apiRequest<ProspectStageDto>(`/api/v1/prospect-stages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          color: input.color,
          is_won: input.isWon,
          is_lost: input.isLost,
          asks_target_date: input.asksTargetDate,
          followup_business_days: input.followupBusinessDays,
          clear_followup_business_days: input.clearFollowupBusinessDays ?? false,
          message_field: input.messageField,
          clear_message_field: input.clearMessageField ?? false,
        }),
      }),
    );
  }

  async deleteStage(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/prospect-stages/${id}`, { method: "DELETE" });
  }

  async reorderStages(orderedIds: string[]): Promise<void> {
    await apiRequest<void>("/api/v1/prospect-stages/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }

  async getDashboardMetrics(period?: Period): Promise<ProspectDashboardMetrics> {
    const params = new URLSearchParams();
    if (period?.dateFrom) params.set("date_from", period.dateFrom);
    if (period?.dateTo) params.set("date_to", period.dateTo);
    const query = params.toString();
    const path = query ? `/api/v1/prospects/dashboard?${query}` : "/api/v1/prospects/dashboard";
    const dto = await apiRequest<ProspectDashboardMetricsDto>(path);
    return {
      total: dto.total,
      today: dto.today,
      week: dto.week,
      month: dto.month,
      won: dto.won,
      open: dto.open,
      lost: dto.lost,
      conversionRate: dto.conversion_rate,
      priorityBreakdown: dto.priority_breakdown.map((p) => ({
        priority: p.priority,
        count: p.count,
        pct: p.pct,
      })),
      funnel: dto.funnel.map((f) => ({
        stageId: f.stage_id,
        label: f.label,
        color: f.color,
        count: f.count,
        pct: f.pct,
      })),
      weekSeries: dto.week_series.map((w) => ({ date: w.date, count: w.count })),
    };
  }

  async listMessageTemplates(): Promise<MessageTemplate[]> {
    const dto = await apiRequest<MessageTemplateDto[]>("/api/v1/prospect-message-templates");
    return dto.map(toMessageTemplate);
  }

  async createMessageTemplate(input: CreateMessageTemplateInput): Promise<MessageTemplate> {
    return toMessageTemplate(
      await apiRequest<MessageTemplateDto>("/api/v1/prospect-message-templates", {
        method: "POST",
        body: JSON.stringify({
          stage_id: input.stageId,
          niche: input.niche,
          message: input.message,
        }),
      }),
    );
  }

  async updateMessageTemplate(
    id: string,
    input: UpdateMessageTemplateInput,
  ): Promise<MessageTemplate> {
    return toMessageTemplate(
      await apiRequest<MessageTemplateDto>(`/api/v1/prospect-message-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ niche: input.niche, message: input.message }),
      }),
    );
  }

  async deleteMessageTemplate(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/prospect-message-templates/${id}`, { method: "DELETE" });
  }

  async listLossReasons(): Promise<ProspectLossReason[]> {
    const dto = await apiRequest<ProspectLossReasonDto[]>("/api/v1/prospect-loss-reasons");
    return dto.map(toLossReason);
  }

  async createLossReason(input: CreateProspectLossReasonInput): Promise<ProspectLossReason> {
    return toLossReason(
      await apiRequest<ProspectLossReasonDto>("/api/v1/prospect-loss-reasons", {
        method: "POST",
        body: JSON.stringify({ name: input.name }),
      }),
    );
  }

  async updateLossReason(
    id: string,
    input: UpdateProspectLossReasonInput,
  ): Promise<ProspectLossReason> {
    return toLossReason(
      await apiRequest<ProspectLossReasonDto>(`/api/v1/prospect-loss-reasons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: input.name }),
      }),
    );
  }

  async deleteLossReason(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/prospect-loss-reasons/${id}`, { method: "DELETE" });
  }
}

interface ProspectLossReasonDto {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function toLossReason(dto: ProspectLossReasonDto): ProspectLossReason {
  return { id: dto.id, name: dto.name, createdAt: dto.created_at, updatedAt: dto.updated_at };
}

interface MessageTemplateDto {
  id: string;
  stage_id: string;
  niche: string | null;
  message: string;
  created_at: string;
  updated_at: string;
}

function toMessageTemplate(dto: MessageTemplateDto): MessageTemplate {
  return {
    id: dto.id,
    stageId: dto.stage_id,
    niche: dto.niche,
    message: dto.message,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

interface ProspectDashboardMetricsDto {
  total: number;
  today: number;
  week: number;
  month: number;
  won: number;
  open: number;
  lost: number;
  conversion_rate: number;
  priority_breakdown: { priority: ProspectPriority; count: number; pct: number }[];
  funnel: { stage_id: string; label: string; color: string; count: number; pct: number }[];
  week_series: { date: string; count: number }[];
}
