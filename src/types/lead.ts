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
  whatsapp: string;
  /** Telefone normalizado (`whatsapp` tem prioridade sobre `phone`) — usado
   * pro link `wa.me/...` do botão de WhatsApp. Ver `utils/leadMessageTemplates.ts`. */
  phoneNormalized: string;
  /** UUID real do estágio no backend — diferente de `stage` (que colapsa
   * pra um funil fixo de 5 chaves, ver `repositories/api/stageMapping.ts`).
   * Templates de mensagem casam pelo estágio real, não pela chave colapsada. */
  stageId: string;
  email: string;
  city: string;
  state: string;
  notes: string;
  stage: StageKey;
  /** `null` = lead de intake público (API Key, backend Fase 6) ainda não
   * atribuído a ninguém — nenhuma tela hoje lê este campo para exibir nome
   * de responsável, mas o tipo precisa refletir o contrato real da API
   * (`GET /api/v1/leads`) desde que esse endpoint público existe. */
  ownerId: string | null;
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
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export type CreateLeadInput = Pick<
  Lead,
  "name" | "company" | "phone" | "email" | "origin" | "value"
> &
  // Criação manual sempre exige um dono real — `ownerId: string | null` do
  // `Lead` é só para leads já existentes (intake público, ver comentário
  // acima); aqui sobrescreve de volta para obrigatório.
  { ownerId: string } & Partial<Pick<Lead, "stage" | "notes">> & { pipelineId?: string };

export type UpdateLeadInput = Partial<
  Pick<Lead, "name" | "company" | "phone" | "email" | "notes" | "value" | "probability" | "tags">
>;

export type DedupeStrategy = "skip" | "update" | "duplicate";

export interface ImportRowInput {
  name: string;
  company?: string;
  position?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  state?: string;
  notes?: string;
  origin?: string;
}

export interface ImportRowResult {
  rowIndex: number;
  outcome: "created" | "updated" | "skipped" | "error";
  name: string;
  detail: string | null;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
}

/** Campos do `Lead` que fazem sentido mapear numa importação de CSV — usado
 * pela tela de import (de/para) para montar os selects. */
export const IMPORTABLE_LEAD_FIELDS: { key: keyof ImportRowInput; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "company", label: "Empresa" },
  { key: "position", label: "Cargo" },
  { key: "phone", label: "Telefone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado (UF)" },
  { key: "notes", label: "Observações" },
  { key: "origin", label: "Origem" },
];

/** Mensagem padrão de WhatsApp por (estágio, origem) — `origin: null` é
 * coringa (vale pra qualquer origem daquele estágio sem template mais
 * específico). Placeholders suportados: `{nome}`, `{empresa}`, `{cidade}`,
 * `{estado}` — ver `utils/leadMessageTemplates.ts`. */
export interface LeadMessageTemplate {
  id: string;
  stageId: string;
  origin: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadMessageTemplateInput {
  stageId: string;
  origin?: string;
  message: string;
}

export interface UpdateLeadMessageTemplateInput {
  origin: string | null;
  message: string;
}
