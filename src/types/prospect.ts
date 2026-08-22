export type PhoneType = "comercial" | "pessoal" | "nao_verificado";

export type WhatsappStatus =
  | "nao_verificado"
  | "valido"
  | "invalido"
  | "contatado_sem_resposta"
  | "respondeu";

export type SiteStatus =
  | "sem_site"
  | "apenas_rede_social"
  | "site_proprio"
  | "site_fraco"
  | "nao_verificado";

export type PageObjective = "orcamento" | "agendamento" | "apresentacao" | "matricula" | "reserva";

export type ProspectPriority = "a" | "b" | "c";

/** De onde a GSM achou o prospect — diferente da "origem" de um Lead (canal
 * pelo qual um CLIENTE do CRM recebeu um lead de fora). */
export type ProspectOrigin = "google_maps" | "indicacao" | "instagram" | "site" | "evento" | "outro";

export type DedupeStrategy = "skip" | "update" | "duplicate";

export interface ProspectStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface Prospect {
  id: string;
  sequenceNumber: number;
  stageId: string;
  companyName: string;
  niche: string;
  mainService: string;
  city: string;
  neighborhood: string;
  googleMapsUrl: string;
  phoneRaw: string;
  phoneNormalized: string;
  phoneType: PhoneType;
  whatsappStatus: WhatsappStatus;
  websiteUrl: string;
  siteStatus: SiteStatus;
  instagram: string;
  googleRating: number | null;
  googleReviewsCount: number | null;
  positiveNote: string;
  opportunity: string;
  pageObjective: PageObjective | null;
  priority: ProspectPriority;
  origin: ProspectOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectListFilter {
  stageId?: string;
  priority?: ProspectPriority;
  pageObjective?: PageObjective;
  origin?: ProspectOrigin;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Não deriva de `Pick<Prospect, ...>` de propósito: os campos opcionais de
 * `Prospect` são `T | null` (o que veio da API), mas aqui "não informado"
 * é sempre "não mudar esse campo" (mesma semântica do backend — ver
 * `UpdateProspectUseCase`, que só inclui em `changes` o que não é `None`).
 * `T | undefined` evita espalhar `?? null` pelos formulários só para
 * satisfazer `exactOptionalPropertyTypes`.
 */
export interface CreateProspectInput {
  stageId: string;
  companyName: string;
  niche?: string;
  mainService?: string;
  city?: string;
  neighborhood?: string;
  googleMapsUrl?: string;
  phoneRaw?: string;
  phoneType?: PhoneType;
  whatsappStatus?: WhatsappStatus;
  websiteUrl?: string;
  siteStatus?: SiteStatus;
  instagram?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  positiveNote?: string;
  opportunity?: string;
  pageObjective?: PageObjective;
  priority?: ProspectPriority;
  origin?: ProspectOrigin;
  force?: boolean;
}

export type UpdateProspectInput = Partial<CreateProspectInput>;

export type CreateProspectStageInput = Pick<ProspectStage, "name" | "color"> &
  Partial<Pick<ProspectStage, "isWon" | "isLost">>;

export type UpdateProspectStageInput = Partial<
  Pick<ProspectStage, "name" | "color" | "isWon" | "isLost">
>;

export interface ProspectDuplicateCheck {
  exists: boolean;
  prospect: Prospect | null;
}

export interface ImportRowInput {
  companyName: string;
  niche?: string;
  mainService?: string;
  city?: string;
  neighborhood?: string;
  googleMapsUrl?: string;
  phoneRaw?: string;
  phoneType?: PhoneType;
  whatsappStatus?: WhatsappStatus;
  websiteUrl?: string;
  siteStatus?: SiteStatus;
  instagram?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  positiveNote?: string;
  opportunity?: string;
  pageObjective?: PageObjective;
  priority?: ProspectPriority;
  origin?: ProspectOrigin;
}

export interface ImportRowResult {
  rowIndex: number;
  outcome: "created" | "updated" | "skipped" | "error";
  companyName: string;
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

/** Campos do `Prospect` que fazem sentido mapear numa importação de CSV —
 * usado pela tela de import (de/para) para montar os selects. */
export const IMPORTABLE_PROSPECT_FIELDS: { key: keyof ImportRowInput; label: string }[] = [
  { key: "companyName", label: "Nome da empresa" },
  { key: "niche", label: "Categoria/nicho" },
  { key: "mainService", label: "Serviço principal" },
  { key: "city", label: "Cidade" },
  { key: "neighborhood", label: "Bairro" },
  { key: "googleMapsUrl", label: "Link do Google Maps" },
  { key: "phoneRaw", label: "Telefone" },
  { key: "phoneType", label: "Tipo de telefone" },
  { key: "whatsappStatus", label: "Status do WhatsApp" },
  { key: "websiteUrl", label: "Site encontrado" },
  { key: "siteStatus", label: "Status do site" },
  { key: "instagram", label: "Instagram" },
  { key: "googleRating", label: "Nota do Google" },
  { key: "googleReviewsCount", label: "Qtd. de avaliações" },
  { key: "positiveNote", label: "Observação positiva" },
  { key: "opportunity", label: "Oportunidade identificada" },
  { key: "pageObjective", label: "Objetivo da página" },
  { key: "priority", label: "Prioridade" },
  { key: "origin", label: "Origem" },
];

export interface ProspectPriorityBreakdown {
  priority: ProspectPriority;
  count: number;
  pct: number;
}

export interface ProspectFunnelStage {
  stageId: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

export interface ProspectWeekBar {
  date: string;
  count: number;
}

export interface ProspectDashboardMetrics {
  total: number;
  today: number;
  week: number;
  month: number;
  won: number;
  open: number;
  lost: number;
  conversionRate: number;
  priorityBreakdown: ProspectPriorityBreakdown[];
  funnel: ProspectFunnelStage[];
  weekSeries: ProspectWeekBar[];
}

/** Mensagem padrão de WhatsApp por (estágio, área) — `niche: null` é
 * coringa (vale pra qualquer área daquele estágio sem template mais
 * específico). Placeholders suportados na mensagem: `{empresa}`, `{nicho}`,
 * `{servico_principal}`, `{cidade}`, `{bairro}` — ver `utils/messageTemplates.ts`. */
export interface MessageTemplate {
  id: string;
  stageId: string;
  niche: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageTemplateInput {
  stageId: string;
  niche?: string;
  message: string;
}

export interface UpdateMessageTemplateInput {
  niche: string | null;
  message: string;
}
