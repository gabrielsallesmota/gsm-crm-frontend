import type { LeadsRepository } from "../LeadsRepository";
import type { CreateLeadInput, Lead, LeadListFilter, UpdateLeadInput } from "../../types/lead";
import type { Page } from "../../types/common";
import type { StageKey } from "../../types/pipeline";
import { delay } from "../../utils/errors";
import { mockState, nextLeadId } from "./state";

export class LeadsMockRepository implements LeadsRepository {
  async list(filter: LeadListFilter): Promise<Page<Lead>> {
    await delay(250);
    let items = mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId);

    if (filter.stageId) items = items.filter((l) => l.stage === filter.stageId);
    if (filter.ownerId) items = items.filter((l) => l.ownerId === filter.ownerId);
    if (filter.origin) items = items.filter((l) => l.origin === filter.origin);
    if (filter.search) {
      const q = filter.search.trim().toLowerCase();
      items = items.filter(
        (l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q),
      );
    }
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
    const lead: Lead = {
      id: nextLeadId(),
      tenantId: mockState.currentTenantId,
      name: input.name,
      company: input.company || "—",
      role: "",
      phone: input.phone,
      email: input.email,
      city: "",
      state: "",
      notes: input.notes ?? "",
      stage: input.stage ?? "novo",
      ownerId: input.ownerId,
      value: input.value,
      probability: 20,
      origin: input.origin,
      tags: [],
      createdAt: new Date().toISOString(),
      firstContactHours: 0,
      lastActivityAt: new Date().toISOString(),
      temperature: "morno",
      sentiment: "Neutro",
      aiProbability: "20%",
      aiSummary: "",
      aiNext: "",
      objections: [],
      custom: {},
      timeline: [
        { icon: "✨", color: "#2ee66e", title: "Lead criado", desc: "Cadastro manual.", at: new Date().toISOString(), who: "Você" },
      ],
      tasks: [],
      events: [],
      files: [],
    };
    mockState.leads.unshift(lead);
    return lead;
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} não encontrado.`);
    Object.assign(lead, input);
    lead.lastActivityAt = new Date().toISOString();
    return lead;
  }

  async move(id: string, stage: StageKey): Promise<Lead> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} não encontrado.`);
    lead.stage = stage;
    lead.lastActivityAt = new Date().toISOString();
    if (stage === "ganho" || stage === "perdido") lead.closedAt = new Date().toISOString();
    return lead;
  }

  async delete(id: string): Promise<void> {
    await delay(150);
    mockState.leads = mockState.leads.filter((l) => l.id !== id);
  }
}
