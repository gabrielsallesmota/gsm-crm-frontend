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
