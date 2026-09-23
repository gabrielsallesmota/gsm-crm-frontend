/** Módulo SDR (Etapa 1 — fundação): campanhas, presets de ICP, candidates
 * (pré-Prospect) e cobertura de busca. Exclusivo de platform staff GSM —
 * sem dado de Google/IA inventado aqui: candidates só existem depois que
 * um futuro worker (fora desta etapa) os ingerir; até lá a lista fica
 * vazia (ver `EmptyState` nas páginas). */

export type SdrCampaignStatus = "draft" | "active" | "paused" | "archived";
export type SdrCriterionKind = "eliminatory" | "preference";
export type SdrCandidateStatus = "novo" | "em_revisao" | "aprovado" | "descartado";
export type SdrDecisionType = "reviewed" | "approved" | "discarded" | "reevaluated";
export type SdrCoverageStatus = "nao_iniciada" | "em_andamento" | "concluida" | "falhou";

export interface SdrLocation {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  locality?: string | null;
}

export interface SdrCriterion {
  kind: SdrCriterionKind;
  key: string;
  value: string;
  weight?: number | null;
}

export interface SdrDiscardReason {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SdrIcpPreset {
  id: string;
  name: string;
  niche: string;
  searchTerms: string[];
  gsmOffers: string[];
  locations: SdrLocation[];
  criteria: SdrCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface SdrCampaignLocation extends SdrLocation {
  id: string;
  campaignId: string;
}

export interface SdrCampaignCriterion extends SdrCriterion {
  id: string;
  campaignId: string;
}

export interface SdrCampaign {
  id: string;
  name: string;
  niche: string;
  searchTerms: string[];
  gsmOffers: string[];
  targetQuantity: number;
  provider: string;
  status: SdrCampaignStatus;
  createdFromPresetId: string | null;
  locations: SdrCampaignLocation[];
  criteria: SdrCampaignCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface SdrCoverage {
  id: string;
  niche: string;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  provider: string;
  searchTermsUsed: string[] | null;
  status: SdrCoverageStatus;
  quantityProcessed: number;
  searchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SdrCandidate {
  id: string;
  companyName: string;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  googleMapsUrl: string | null;
  niche: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  status: SdrCandidateStatus;
  discardReasonId: string | null;
  knownDuplicateProspectId: string | null;
  knownDuplicateClientId: string | null;
  approvedProspectId: string | null;
  createdAt: string;
  updatedAt: string;
  // Etapa 3 — enriquecimento (CNPJ) + deduplicação forte.
  providerRef: string | null;
  cnpj: string | null;
  domain: string | null;
  email: string | null;
  instagramHandle: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnae: string | null;
  situacaoCadastral: string | null;
  dataAbertura: string | null;
  capitalSocialCents: number | null;
  lastEnrichmentAt: string | null;
}

export interface SdrCandidateAppearance {
  id: string;
  candidateId: string;
  campaignId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  timesSeen: number;
  score: number | null;
}

export interface SdrCandidateDecision {
  id: string;
  candidateId: string;
  campaignId: string | null;
  decision: SdrDecisionType;
  fromStatus: SdrCandidateStatus | null;
  toStatus: SdrCandidateStatus | null;
  discardReasonId: string | null;
  notes: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface SdrCandidateListFilter {
  status?: SdrCandidateStatus;
  campaignId?: string;
  niche?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateSdrDiscardReasonInput {
  name: string;
}

export interface CreateSdrIcpPresetInput {
  name: string;
  niche: string;
  searchTerms?: string[];
  gsmOffers?: string[];
  locations?: SdrLocation[];
  criteria?: SdrCriterion[];
}

export type UpdateSdrIcpPresetInput = Partial<CreateSdrIcpPresetInput>;

export interface CreateSdrCampaignInput {
  name: string;
  niche: string;
  locations?: SdrLocation[];
  searchTerms?: string[];
  gsmOffers?: string[];
  criteria?: SdrCriterion[];
  targetQuantity?: number;
  provider?: string;
  status?: SdrCampaignStatus;
  fromPresetId?: string;
}

export interface UpdateSdrCampaignInput {
  name?: string;
  niche?: string;
  searchTerms?: string[];
  gsmOffers?: string[];
  targetQuantity?: number;
  provider?: string;
  status?: SdrCampaignStatus;
  locations?: SdrLocation[];
  criteria?: SdrCriterion[];
}

export interface CreateSdrCoverageInput {
  niche: string;
  provider: string;
  country?: string;
  state?: string;
  city?: string;
  locality?: string;
  searchTermsUsed?: string[];
  status?: SdrCoverageStatus;
}

export interface UpdateSdrCoverageInput {
  status?: SdrCoverageStatus;
  quantityProcessed?: number;
  searchTermsUsed?: string[];
}

export type SdrBulkAction = "review" | "approve" | "discard";

export interface SdrBulkActionInput {
  action: SdrBulkAction;
  candidateIds: string[];
  discardReasonId?: string;
  notes?: string;
}

export interface SdrBulkActionRowResult {
  candidateId: string;
  outcome: "ok" | "error";
  detail: string | null;
}

export interface SdrBulkActionSummary {
  total: number;
  ok: number;
  errors: number;
  rows: SdrBulkActionRowResult[];
}

export const SDR_CANDIDATE_STATUS_LABEL: Record<SdrCandidateStatus, string> = {
  novo: "Novo",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  descartado: "Descartado",
};

export const SDR_CAMPAIGN_STATUS_LABEL: Record<SdrCampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};

export const SDR_COVERAGE_STATUS_LABEL: Record<SdrCoverageStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  falhou: "Falhou",
};

export const SDR_DECISION_LABEL: Record<SdrDecisionType, string> = {
  reviewed: "Revisado",
  approved: "Aprovado",
  discarded: "Descartado",
  reevaluated: "Reavaliado",
};

// ---------------------------------------------------------------------------
// Etapa 2 — execução real (worker + Google Places).
// ---------------------------------------------------------------------------

/** O backend decide o que pular por modo (nunca o frontend): `reuse_known`
 * nunca chama o provider (só reaproveita o que já existe), `find_new` pula
 * combinações já `concluida` em `SdrCoverage`, `full_refresh` nunca pula. */
export type SdrRunMode = "reuse_known" | "find_new" | "full_refresh";

export type SdrRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type SdrDiscoveryJobStatus = "pending" | "running" | "succeeded" | "failed" | "dead";

export const SDR_RUN_TERMINAL_STATUSES: ReadonlySet<SdrRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export interface SdrCampaignRun {
  id: string;
  tenantId: string;
  campaignId: string;
  mode: SdrRunMode;
  status: SdrRunStatus;
  targetQuantity: number;
  maxProviderCalls: number | null;
  foundCount: number;
  duplicateCount: number;
  processedCount: number;
  failureCount: number;
  currentStage: string | null;
  actorUserId: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartSdrCampaignRunInput {
  mode: SdrRunMode;
  targetQuantity?: number;
  maxProviderCalls?: number;
}

export interface SdrDiscoveryJob {
  id: string;
  runId: string;
  campaignId: string;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  searchTerm: string;
  pageToken: string | null;
  status: SdrDiscoveryJobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SdrProviderUsageEntry {
  id: string;
  campaignId: string | null;
  runId: string | null;
  provider: string;
  sku: string;
  fieldMask: string;
  units: number;
  estimatedCostCents: number | null;
  createdAt: string;
}

export const SDR_RUN_STATUS_LABEL: Record<SdrRunStatus, string> = {
  queued: "Na fila",
  running: "Em execução",
  paused: "Pausada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const SDR_RUN_MODE_LABEL: Record<SdrRunMode, string> = {
  reuse_known: "Reutilizar base conhecida",
  find_new: "Buscar novidades",
  full_refresh: "Refazer busca completa",
};

// ---------------------------------------------------------------------------
// Etapa 3 — enriquecimento (CNPJ) + deduplicação forte. Enriquecimento é
// sempre opcional/não-bloqueante — nunca inventa CNPJ a partir do nome, só
// consulta quando um humano já anexou um. Deduplicação por sinal fraco
// (nome+cidade) NUNCA funde nada sozinha — só sugere pra um humano decidir.
// ---------------------------------------------------------------------------

export type SdrEnrichmentSource = "cnpj_receitaws";

export type SdrEnrichmentStatus =
  | "success"
  | "not_found"
  | "unavailable"
  | "not_configured"
  | "skipped";

export type SdrMatchConfidence = "strong" | "weak";

export type SdrDuplicateSignal =
  | "google_place_id"
  | "cnpj"
  | "maps_url"
  | "domain"
  | "phone"
  | "email"
  | "instagram"
  | "name_location";

export type SdrDuplicateTargetType = "candidate" | "prospect" | "client";

export type SdrDuplicateSuggestionStatus = "pending" | "confirmed" | "dismissed";

export interface SdrCandidateEnrichment {
  id: string;
  candidateId: string;
  source: SdrEnrichmentSource;
  status: SdrEnrichmentStatus;
  confidence: SdrMatchConfidence | null;
  cnpjQueried: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnae: string | null;
  situacaoCadastral: string | null;
  dataAbertura: string | null;
  capitalSocialCents: number | null;
  email: string | null;
  errorDetail: string | null;
  fetchedAt: string;
  createdAt: string;
}

export interface SdrDuplicateSuggestion {
  id: string;
  candidateId: string;
  targetType: SdrDuplicateTargetType;
  targetId: string;
  signal: SdrDuplicateSignal;
  confidence: SdrMatchConfidence;
  status: SdrDuplicateSuggestionStatus;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
}

export interface SetCandidateCnpjResult {
  candidate: SdrCandidate;
  checkDigitsValid: boolean;
}

export const SDR_ENRICHMENT_SOURCE_LABEL: Record<SdrEnrichmentSource, string> = {
  cnpj_receitaws: "ReceitaWS",
};

export const SDR_ENRICHMENT_STATUS_LABEL: Record<SdrEnrichmentStatus, string> = {
  success: "Sucesso",
  not_found: "CNPJ não encontrado",
  unavailable: "Fonte indisponível",
  not_configured: "Não configurado",
  skipped: "Pulado (sem CNPJ)",
};

export const SDR_DUPLICATE_SIGNAL_LABEL: Record<SdrDuplicateSignal, string> = {
  google_place_id: "Place ID do Google",
  cnpj: "CNPJ",
  maps_url: "URL do Maps",
  domain: "Domínio",
  phone: "Telefone",
  email: "E-mail",
  instagram: "Instagram",
  name_location: "Nome + cidade (sinal fraco)",
};

export const SDR_DUPLICATE_TARGET_TYPE_LABEL: Record<SdrDuplicateTargetType, string> = {
  candidate: "Candidate",
  prospect: "Prospect",
  client: "Cliente",
};

// ---------------------------------------------------------------------------
// Etapa 4 — auditoria determinística de sites (sem análise comercial, sem
// IA). Cada sinal é um FATO com evidência de onde veio — nunca diagnóstico
// comercial (isso é scoring/IA, fora desta etapa).
// ---------------------------------------------------------------------------

export type SdrAuditStatus = "success" | "partial" | "failed" | "skipped";

export interface SdrAuditSignalValue {
  value: unknown;
  evidence: string;
  sourceUrl: string;
}

export interface SdrAuditPageCheck {
  url: string;
  pageKind: string;
  ok: boolean;
  httpStatus: number | null;
  error: string | null;
}

export interface SdrCandidateAudit {
  id: string;
  candidateId: string;
  auditorVersion: number;
  status: SdrAuditStatus;
  signals: Record<string, SdrAuditSignalValue>;
  pagesChecked: SdrAuditPageCheck[];
  pagespeed: SdrPerformanceReport | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
}

export const SDR_AUDIT_STATUS_LABEL: Record<SdrAuditStatus, string> = {
  success: "Sucesso — todas as páginas verificadas responderam",
  partial: "Parcial — pelo menos uma página falhou",
  failed: "Falhou — o site não respondeu",
  skipped: "Sem site anexado ainda",
};

// ---------------------------------------------------------------------------
// Performance (PageSpeed) — dois providers possíveis por baixo do mesmo
// campo `pagespeed` (Google PageSpeed só pede a categoria Performance, por
// custo/quota; Lighthouse local roda as 4 categorias) — o frontend nunca
// inventa um campo que o provider em questão não devolveu.
// ---------------------------------------------------------------------------

export type SdrPerformanceProvider = "pagespeed_google" | "lighthouse_local";

export interface SdrPerformanceReport {
  provider?: SdrPerformanceProvider;
  url_analyzed?: string;
  performance_score?: number | null;
  accessibility_score?: number | null;
  best_practices_score?: number | null;
  seo_score?: number | null;
  first_contentful_paint?: string | null;
  largest_contentful_paint?: string | null;
  cumulative_layout_shift?: string | null;
  total_blocking_time?: string | null;
  speed_index?: string | null;
}

export const SDR_PERFORMANCE_PROVIDER_LABEL: Record<SdrPerformanceProvider, string> = {
  pagespeed_google: "Google PageSpeed",
  lighthouse_local: "Lighthouse local",
};

export const SDR_AUDIT_PAGE_KIND_LABEL: Record<string, string> = {
  home: "Home",
  contact: "Contato",
  services: "Serviços",
  scheduling: "Agendamento",
  about: "Sobre",
};

export const SDR_AUDIT_SIGNAL_LABEL: Record<string, string> = {
  https: "HTTPS",
  availability: "Disponibilidade",
  title: "Título da página",
  meta_description: "Meta description",
  viewport: "Viewport (responsividade)",
  h1: "H1",
  forms: "Formulários",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  phone: "Telefone",
  ctas: "Chamadas para ação",
  analytics: "Analytics/Pixel",
  contact_page_found: "Página de contato",
  services_page_found: "Página de serviços",
  scheduling_page_found: "Página de agendamento",
  about_page_found: "Página sobre",
};

// ---------------------------------------------------------------------------
// Etapa 5 — Score GSM determinístico (SEM IA/LLM). Regras/pesos vivem só no
// backend (`scoring_rules.py`) — o frontend só exibe o breakdown já
// calculado, nunca recalcula nem interpreta nada.
// ---------------------------------------------------------------------------

export type SdrPriority = "a" | "b" | "c";

export interface SdrScoreBreakdownEntry {
  rule: string;
  component: "commercial_potential" | "digital_gap" | "gsm_fit";
  points: number;
  matched: boolean;
  description: string;
  evidence: string;
}

export interface SdrCandidateScore {
  id: string;
  candidateId: string;
  ruleSet: string;
  total: number;
  commercialPotential: number;
  digitalGap: number;
  gsmFit: number;
  priority: SdrPriority;
  breakdown: SdrScoreBreakdownEntry[];
  computedAt: string;
  createdAt: string;
}

export const SDR_PRIORITY_LABEL: Record<SdrPriority, string> = {
  a: "A — Prioridade alta",
  b: "B — Prioridade média",
  c: "C — Prioridade baixa",
};

// ---------------------------------------------------------------------------
// Etapa 6 — IA Comercial. A IA só INTERPRETA fatos já coletados (nunca
// calcula/altera Score, nunca aprova/descarta, nunca envia mensagem — isso
// é Etapa 7). O frontend só exibe/edita localmente a sugestão.
// ---------------------------------------------------------------------------

export type SdrOutreachChannel = "whatsapp" | "instagram" | "email";
export type SdrOutreachTone = "standard" | "shorter" | "consultative";
export type SdrOutreachStatus = "success" | "invalid_output" | "provider_error" | "not_configured";

export interface SdrOutreachAnalysis {
  positive_signals: string[];
  opportunities: string[];
  recommended_solution: string;
  commercial_hook: string;
  initial_message: string;
  alternative_message: string | null;
}

export interface SdrCandidateOutreachGeneration {
  id: string;
  candidateId: string;
  scoreId: string | null;
  promptVersion: string;
  model: string;
  channel: SdrOutreachChannel;
  tone: SdrOutreachTone;
  status: SdrOutreachStatus;
  analysis: SdrOutreachAnalysis | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostCents: number | null;
  errorDetail: string | null;
  createdAt: string;
}

export const SDR_OUTREACH_CHANNEL_LABEL: Record<SdrOutreachChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
};

export const SDR_OUTREACH_TONE_LABEL: Record<SdrOutreachTone, string> = {
  standard: "Tom padrão GSM",
  shorter: "Mais curto",
  consultative: "Mais consultivo",
};

export const SDR_OUTREACH_STATUS_LABEL: Record<SdrOutreachStatus, string> = {
  success: "Sucesso",
  invalid_output: "Resposta inválida da IA",
  provider_error: "Falha ao consultar a IA",
  not_configured: "IA não configurada",
};

// ---------------------------------------------------------------------------
// Etapa 7 — operação comercial. Composto (Prospect + Score/IA do SDR) —
// só leitura; confirmar contato/mover estágio continuam nos fluxos já
// existentes de Prospect (não duplicados aqui).
// ---------------------------------------------------------------------------

export interface SdrProspectingQueueFilter {
  niche?: string;
  minPriority?: SdrPriority;
}

export interface SdrProspectSdrContext {
  prospectId: string;
  companyName: string;
  phoneRaw: string | null;
  city: string | null;
  niche: string | null;
  googleMapsUrl: string | null;
  candidateId: string | null;
  scoreTotal: number | null;
  scorePriority: SdrPriority | null;
  outreachChannel: SdrOutreachChannel | null;
  outreachMessage: string | null;
  outreachHook: string | null;
  outreachOpportunities: string[] | null;
}

// ---------------------------------------------------------------------------
// Etapa 8 — dashboard, funil real e Score×resultado. Estágios além de
// contatados/ganhos/perdidos vêm do nome REAL configurado pelo tenant
// (`stageDistribution`) — nunca um rótulo fixo tipo "Respondeu"/"Reunião"
// que o histórico não comprova.
// ---------------------------------------------------------------------------

export interface SdrFunnelStageDistribution {
  stageId: string;
  stageName: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  count: number;
}

export interface SdrFunnelSummary {
  encontrados: number;
  qualificados: number;
  aprovados: number;
  contatados: number;
  ganhos: number;
  perdidos: number;
  stageDistribution: SdrFunnelStageDistribution[];
}

export interface SdrScoreOutcomeBucket {
  priority: SdrPriority;
  aprovados: number;
  contatados: number;
  ganhos: number;
  perdidos: number;
  taxaContato: number | null;
  taxaGanho: number | null;
}

export interface SdrInsight {
  text: string;
  sampleSize: number;
}

export interface SdrDashboardOverview {
  funnel: SdrFunnelSummary;
  scoreOutcome: SdrScoreOutcomeBucket[];
  insights: SdrInsight[];
}

export interface SdrProviderCostSummary {
  provider: string;
  totalUnits: number;
  totalCostCents: number;
  callsCount: number;
}
