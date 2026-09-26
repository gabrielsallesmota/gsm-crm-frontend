import type {
  CreateSdrCampaignInput,
  CreateSdrCoverageInput,
  CreateSdrDiscardReasonInput,
  CreateSdrIcpPresetInput,
  SdrBulkActionInput,
  SdrBulkActionSummary,
  SdrCampaign,
  SdrCampaignRun,
  SdrCandidate,
  SdrCandidateAppearance,
  SdrCandidateAudit,
  SdrCandidateDecision,
  SdrCandidateOutreachGeneration,
  SdrCandidateScore,
  SdrOutreachChannel,
  SdrOutreachTone,
  SdrProspectSdrContext,
  SdrProspectingQueueFilter,
  SdrDashboardOverview,
  SdrProviderCostSummary,
  SdrSearchTermCatalog,
  SdrCandidateEnrichment,
  SdrCandidateListFilter,
  SdrCoverage,
  SdrDiscardReason,
  SdrDiscoveryJob,
  SdrDiscoveryJobStatus,
  SdrDuplicateSuggestion,
  SdrDuplicateSuggestionStatus,
  SdrIcpPreset,
  SdrProviderUsageEntry,
  SetCandidateCnpjResult,
  StartSdrCampaignRunInput,
  UpdateSdrCampaignInput,
  UpdateSdrCoverageInput,
  UpdateSdrIcpPresetInput,
} from "../types/sdr";
import type { Page } from "../types/common";

/** Mesma convenção de `ProspectsRepository`: um módulo, uma interface só
 * (campanhas + presets + candidates + cobertura + motivos de descarte),
 * mesmo cobrindo vários sub-recursos — não split por sub-recurso. */
export interface SdrRepository {
  listCampaigns(status?: string, niche?: string, search?: string): Promise<SdrCampaign[]>;
  getCampaign(id: string): Promise<SdrCampaign>;
  createCampaign(input: CreateSdrCampaignInput): Promise<SdrCampaign>;
  updateCampaign(id: string, input: UpdateSdrCampaignInput): Promise<SdrCampaign>;
  deleteCampaign(id: string): Promise<void>;

  listIcpPresets(): Promise<SdrIcpPreset[]>;

  listSearchTerms(provider: string): Promise<SdrSearchTermCatalog>;
  createIcpPreset(input: CreateSdrIcpPresetInput): Promise<SdrIcpPreset>;
  updateIcpPreset(id: string, input: UpdateSdrIcpPresetInput): Promise<SdrIcpPreset>;
  deleteIcpPreset(id: string): Promise<void>;

  listDiscardReasons(): Promise<SdrDiscardReason[]>;
  createDiscardReason(input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason>;
  updateDiscardReason(id: string, input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason>;
  deleteDiscardReason(id: string): Promise<void>;

  listCoverage(): Promise<SdrCoverage[]>;
  createCoverage(input: CreateSdrCoverageInput): Promise<SdrCoverage>;
  updateCoverage(id: string, input: UpdateSdrCoverageInput): Promise<SdrCoverage>;
  deleteCoverage(id: string): Promise<void>;

  listCandidates(filter: SdrCandidateListFilter): Promise<Page<SdrCandidate>>;
  getCandidate(id: string): Promise<SdrCandidate>;
  listCandidateDecisions(id: string): Promise<SdrCandidateDecision[]>;
  listCandidateAppearances(id: string): Promise<SdrCandidateAppearance[]>;
  reviewCandidate(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate>;
  approveCandidate(id: string, campaignId?: string): Promise<SdrCandidate>;
  discardCandidate(
    id: string,
    discardReasonId: string,
    notes?: string,
    campaignId?: string,
  ): Promise<SdrCandidate>;
  reevaluateCandidate(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate>;
  bulkCandidateAction(input: SdrBulkActionInput): Promise<SdrBulkActionSummary>;

  // Etapa 2 — execução real (worker + Google Places). O backend decide o
  // que pular por `mode` — o frontend só escolhe o modo, nunca dedupe.
  startCampaignRun(campaignId: string, input: StartSdrCampaignRunInput): Promise<SdrCampaignRun>;
  listCampaignRuns(campaignId: string): Promise<SdrCampaignRun[]>;
  getCampaignRun(runId: string): Promise<SdrCampaignRun>;
  listRunJobs(runId: string, status?: SdrDiscoveryJobStatus): Promise<SdrDiscoveryJob[]>;
  pauseCampaignRun(runId: string): Promise<SdrCampaignRun>;
  resumeCampaignRun(runId: string): Promise<SdrCampaignRun>;
  cancelCampaignRun(runId: string): Promise<SdrCampaignRun>;
  reprocessFailedJobs(runId: string): Promise<{ reprocessed: number }>;
  getUsageSummary(limit?: number): Promise<SdrProviderUsageEntry[]>;

  // Etapa 3 — enriquecimento (CNPJ) + deduplicação forte.
  setCandidateCnpj(id: string, cnpj: string): Promise<SetCandidateCnpjResult>;
  refreshCandidateEnrichment(id: string, force?: boolean): Promise<SdrCandidate>;
  listCandidateEnrichments(id: string): Promise<SdrCandidateEnrichment[]>;
  listDuplicateSuggestions(
    id: string,
    status?: SdrDuplicateSuggestionStatus,
  ): Promise<SdrDuplicateSuggestion[]>;
  confirmDuplicateSuggestion(candidateId: string, suggestionId: string): Promise<SdrDuplicateSuggestion>;
  dismissDuplicateSuggestion(candidateId: string, suggestionId: string): Promise<SdrDuplicateSuggestion>;

  // Etapa 4 — auditoria determinística de sites (sem análise comercial, sem IA).
  setCandidateWebsite(id: string, website: string): Promise<SdrCandidate>;
  refreshCandidateAudit(id: string, force?: boolean): Promise<SdrCandidate>;
  listCandidateAudits(id: string): Promise<SdrCandidateAudit[]>;

  // Etapa 5 — Score GSM determinístico (sem IA/LLM).
  computeCandidateScore(id: string, ruleSet?: string): Promise<SdrCandidateScore>;
  listCandidateScores(id: string): Promise<SdrCandidateScore[]>;
  computeCampaignScores(campaignId: string): Promise<{ enqueued: boolean }>;

  // Etapa 6 — IA Comercial.
  generateCandidateOutreach(
    id: string,
    channel: SdrOutreachChannel,
    tone?: SdrOutreachTone,
  ): Promise<{ enqueued: boolean }>;
  listCandidateOutreachGenerations(id: string): Promise<SdrCandidateOutreachGeneration[]>;

  // Etapa 7 — operação comercial ("Prospectar hoje").
  listProspectingQueue(filter?: SdrProspectingQueueFilter): Promise<SdrProspectSdrContext[]>;
  getProspectOutreachContext(prospectId: string): Promise<SdrProspectSdrContext>;

  // Etapa 8 — dashboard, funil real e custos.
  getDashboardOverview(): Promise<SdrDashboardOverview>;
  getDashboardCosts(): Promise<SdrProviderCostSummary[]>;
}
