/**
 * Lead como o backend devolve. Só dados REAIS: os campos fictícios que o
 * protótipo exibia (temperatura, "IA", objeções, arquivos, timeline de
 * exemplo, "1º atendimento") foram removidos na Etapa 1 — a timeline agora
 * vem de `GET /leads/{id}/timeline` (ver `LeadTimelineItem`).
 */

/** Anotação datada de alguém sobre o lead — histórico append-only,
 * diferente de `Lead.notes` (campo livre único, sobrescrito a cada
 * edição). */
export interface LeadComment {
  id: string;
  leadId: string;
  authorUserId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

/** Só o preview do comentário mais recente — o que aparece no card do
 * Kanban sem abrir o lead. */
export interface LastCommentPreview {
  text: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  company: string;
  /** Cargo (`position` no backend). */
  role: string;
  phone: string;
  whatsapp: string;
  /** Telefone normalizado (`whatsapp` tem prioridade sobre `phone`) — usado
   * pro link `wa.me/...` do botão de WhatsApp. */
  phoneNormalized: string;
  email: string;
  city: string;
  state: string;
  notes: string;
  pipelineId: string;
  /** UUID REAL da etapa no backend — identidade da etapa. */
  stageId: string;
  /** `null` = lead de intake público (API Key) ainda sem responsável. */
  ownerId: string | null;
  value: number;
  probability: number;
  origin: string;
  tags: string[];
  lastComment?: LastCommentPreview | null;
  createdAt: string;
  updatedAt: string;
  /** Última movimentação de etapa (`last_interaction_at`); `null` se nunca moveu. */
  lastInteractionAt: string | null;
}

/** Item da timeline COMERCIAL do lead (`GET /leads/{id}/timeline`) —
 * eventos reais + comentários, mais recentes primeiro. Diferente do audit
 * log técnico. */
export type LeadTimelineType =
  | "created"
  | "stage_changed"
  | "won"
  | "lost"
  | "owner_changed"
  | "updated"
  | "task_created"
  | "task_completed"
  | "task_reopened"
  | "comment";

export interface LeadTimelineItem {
  id: string;
  type: LeadTimelineType | string;
  createdAt: string;
  actorType: "user" | "api_key" | "system" | string;
  actorName: string | null;
  payload: Record<string, unknown>;
  text: string | null;
}

export interface LeadListFilter {
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  /** Só leads sem responsável (fila do intake público). */
  unassigned?: boolean;
  origin?: string;
  tagId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface CreateLeadInput {
  name: string;
  company: string;
  phone: string;
  email: string;
  origin: string;
  value: number;
  /** Criação manual sempre exige um dono real. */
  ownerId: string;
  pipelineId: string;
  /** Etapa inicial; omitida = primeira etapa em andamento do pipeline. */
  stageId?: string;
  notes?: string;
}

export type UpdateLeadInput = Partial<
  Pick<
    Lead,
    "name" | "company" | "phone" | "email" | "notes" | "value" | "probability" | "tags" | "origin"
  >
> & { ownerId?: string };

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
