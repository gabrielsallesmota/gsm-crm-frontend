import type { StageKey } from "./pipeline";

export type Temperature = "frio" | "morno" | "quente";

export interface LeadTimelineEntry {
  icon: string;
  color: string;
  title: string;
  desc: string;
  at: string;
  who: string;
}

export interface LeadFile {
  id: string;
  name: string;
  size: string;
  kind: string;
  at: string;
}

export interface LeadTaskRef {
  id: string;
  title: string;
  priority: "alta" | "media" | "baixa";
  done: boolean;
  dueAt: string;
}

export interface LeadEventRef {
  id: string;
  title: string;
  type: "retorno" | "reuniao" | "visita";
  at: string;
  time: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  company: string;
  role: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  notes: string;
  stage: StageKey;
  ownerId: string;
  value: number;
  probability: number;
  origin: string;
  tags: string[];
  createdAt: string;
  firstContactHours: number;
  lastActivityAt: string;
  closedAt?: string;
  lossReason?: string;
  temperature: Temperature;
  sentiment: string;
  aiProbability: string;
  aiSummary: string;
  aiNext: string;
  objections: string[];
  custom: Record<string, string>;
  timeline: LeadTimelineEntry[];
  tasks: LeadTaskRef[];
  events: LeadEventRef[];
  files: LeadFile[];
}

export interface LeadListFilter {
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  origin?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export type CreateLeadInput = Pick<
  Lead,
  "name" | "company" | "phone" | "email" | "origin" | "value" | "ownerId"
> &
  Partial<Pick<Lead, "stage" | "notes">> & { pipelineId?: string };

export type UpdateLeadInput = Partial<
  Pick<Lead, "name" | "company" | "phone" | "email" | "notes" | "value" | "probability" | "tags">
>;
