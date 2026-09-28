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
import { delay, NotImplementedError } from "../../utils/errors";
import { mockState, nextLeadId } from "./state";

const IMPORT_TEMPLATE_REASON =
  "Import/export de CSV e mensagens padrão de WhatsApp ainda não fazem parte da demonstração pública — disponível com uma conta real.";

export class LeadsMockRepository implements LeadsRepository {
  async list(filter: LeadListFilter): Promise<Page<Lead>> {
    await delay(250);
    let items = mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId);

    if (filter.pipelineId) items = items.filter((l) => l.pipelineId === filter.pipelineId);
    if (filter.stageId) items = items.filter((l) => l.stageId === filter.stageId);
    if (filter.ownerId) items = items.filter((l) => l.ownerId === filter.ownerId);
    else if (filter.unassigned) items = items.filter((l) => l.ownerId === null);
    if (filter.tagId) items = items.filter((l) => l.tags.includes(filter.tagId!));
    if (filter.origin) items = items.filter((l) => l.origin === filter.origin);
    if (filter.search) {
      const q = filter.search.trim().toLowerCase();
      items = items.filter(
        (l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q),
      );
    }
    if (filter.dateFrom) items = items.filter((l) => l.createdAt.slice(0, 10) >= filter.dateFrom!);
    if (filter.dateTo) items = items.filter((l) => l.createdAt.slice(0, 10) <= filter.dateTo!);
    if (filter.sortBy === "value") {
      items = [...items].sort((a, b) => (filter.sortDir === "asc" ? a.value - b.value : b.value - a.value));
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }

  async get(id: string): Promise<Lead> {
    await delay(150);
    const lead = mockState.leads.find((l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} não encontrado.`);
    return lead;
  }

  async create(input: CreateLeadInput): Promise<Lead> {
    await delay(250);
    const pipeline = mockState.pipelines.find((p) => p.id === input.pipelineId);
    const stageId =
      input.stageId ??
      pipeline?.stages.find((st) => !st.isWon && !st.isLost)?.id ??
      pipeline?.stages[0]?.id ??
      "";
    const now = new Date().toISOString();
    const lead: Lead = {
      id: nextLeadId(),
      tenantId: mockState.currentTenantId,
      name: input.name,
      company: input.company,
      role: "",
      phone: input.phone,
      whatsapp: "",
      phoneNormalized: "",
      email: input.email,
      city: "",
      state: "",
      notes: input.notes ?? "",
      pipelineId: input.pipelineId,
      stageId,
      ownerId: input.ownerId,
      value: input.value,
      probability: 20,
      origin: input.origin,
      tags: [],
      createdAt: now,
      updatedAt: now,
      lastInteractionAt: null,
    };
    mockState.leads.unshift(lead);
    return lead;
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} não encontrado.`);
    Object.assign(lead, input);
    lead.updatedAt = new Date().toISOString();
    return lead;
  }

  async move(id: string, stageId: string): Promise<Lead> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} não encontrado.`);
    const pipeline = mockState.pipelines.find((p) => p.id === lead.pipelineId);
    if (!pipeline?.stages.some((st) => st.id === stageId)) {
      throw new Error("A etapa informada não pertence ao pipeline deste lead.");
    }
    lead.stageId = stageId;
    lead.lastInteractionAt = new Date().toISOString();
    return lead;
  }

  /** A demonstração não grava eventos — mostra só os comentários (dado
   * de exemplo real da sessão), nunca uma timeline inventada. */
  async timeline(id: string): Promise<LeadTimelineItem[]> {
    await delay(150);
    return (mockState.leadComments[id] ?? []).map((c) => ({
      id: c.id,
      type: "comment",
      createdAt: c.createdAt,
      actorType: "user",
      actorName: c.authorName,
      payload: {},
      text: c.text,
    }));
  }

  async delete(id: string): Promise<void> {
    await delay(150);
    mockState.leads = mockState.leads.filter((l) => l.id !== id);
  }

  async bulkImport(
    _rows: ImportRowInput[],
    _pipelineId: string,
    _defaultStageId: string,
    _defaultOwnerId: string,
    _dedupeStrategy: DedupeStrategy,
  ): Promise<ImportSummary> {
    throw new NotImplementedError("Import de CSV", IMPORT_TEMPLATE_REASON);
  }

  async exportCsv(): Promise<string> {
    throw new NotImplementedError("Export de CSV", IMPORT_TEMPLATE_REASON);
  }

  async listMessageTemplates(): Promise<LeadMessageTemplate[]> {
    throw new NotImplementedError("Mensagens de WhatsApp", IMPORT_TEMPLATE_REASON);
  }

  async createMessageTemplate(
    _input: CreateLeadMessageTemplateInput,
  ): Promise<LeadMessageTemplate> {
    throw new NotImplementedError("Mensagens de WhatsApp", IMPORT_TEMPLATE_REASON);
  }

  async updateMessageTemplate(
    _id: string,
    _input: UpdateLeadMessageTemplateInput,
  ): Promise<LeadMessageTemplate> {
    throw new NotImplementedError("Mensagens de WhatsApp", IMPORT_TEMPLATE_REASON);
  }

  async deleteMessageTemplate(_id: string): Promise<void> {
    throw new NotImplementedError("Mensagens de WhatsApp", IMPORT_TEMPLATE_REASON);
  }
}
