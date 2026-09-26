import type { SdrRepository } from "../repositories/SdrRepository";
import { SdrApiRepository } from "../repositories/api/SdrApiRepository";
import { SdrMockRepository } from "../repositories/mock/SdrMockRepository";
import { selectRepository } from "./factory";
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
  SdrCandidateEnrichment,
  SdrCandidateListFilter,
  SdrCandidateOutreachGeneration,
  SdrCandidateScore,
  SdrOutreachChannel,
  SdrOutreachTone,
  SdrProspectSdrContext,
  SdrProspectingQueueFilter,
  SdrDashboardOverview,
  SdrProviderCostSummary,
  SdrSearchTermCatalog,
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

const repo: SdrRepository = selectRepository(
  () => new SdrMockRepository(),
  () => new SdrApiRepository(),
);

export class SdrService {
  listCampaigns(status?: string, niche?: string, search?: string): Promise<SdrCampaign[]> {
    return repo.listCampaigns(status, niche, search);
  }

  getCampaign(id: string): Promise<SdrCampaign> {
    return repo.getCampaign(id);
  }

  createCampaign(input: CreateSdrCampaignInput): Promise<SdrCampaign> {
    return repo.createCampaign(input);
  }

  updateCampaign(id: string, input: UpdateSdrCampaignInput): Promise<SdrCampaign> {
    return repo.updateCampaign(id, input);
  }

  deleteCampaign(id: string): Promise<void> {
    return repo.deleteCampaign(id);
  }

  listSearchTerms(provider: string): Promise<SdrSearchTermCatalog> {
    return repo.listSearchTerms(provider);
  }

  listIcpPresets(): Promise<SdrIcpPreset[]> {
    return repo.listIcpPresets();
  }

  createIcpPreset(input: CreateSdrIcpPresetInput): Promise<SdrIcpPreset> {
    return repo.createIcpPreset(input);
  }

  updateIcpPreset(id: string, input: UpdateSdrIcpPresetInput): Promise<SdrIcpPreset> {
    return repo.updateIcpPreset(id, input);
  }

  deleteIcpPreset(id: string): Promise<void> {
    return repo.deleteIcpPreset(id);
  }

  listDiscardReasons(): Promise<SdrDiscardReason[]> {
    return repo.listDiscardReasons();
  }

  createDiscardReason(input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason> {
    return repo.createDiscardReason(input);
  }

  updateDiscardReason(id: string, input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason> {
    return repo.updateDiscardReason(id, input);
  }

  deleteDiscardReason(id: string): Promise<void> {
    return repo.deleteDiscardReason(id);
  }

  listCoverage(): Promise<SdrCoverage[]> {
    return repo.listCoverage();
  }

  createCoverage(input: CreateSdrCoverageInput): Promise<SdrCoverage> {
    return repo.createCoverage(input);
  }

  updateCoverage(id: string, input: UpdateSdrCoverageInput): Promise<SdrCoverage> {
    return repo.updateCoverage(id, input);
  }

  deleteCoverage(id: string): Promise<void> {
    return repo.deleteCoverage(id);
  }

  listCandidates(filter: SdrCandidateListFilter): Promise<Page<SdrCandidate>> {
    return repo.listCandidates(filter);
  }

  getCandidate(id: string): Promise<SdrCandidate> {
    return repo.getCandidate(id);
  }

  listCandidateDecisions(id: string): Promise<SdrCandidateDecision[]> {
    return repo.listCandidateDecisions(id);
  }

  listCandidateAppearances(id: string): Promise<SdrCandidateAppearance[]> {
    return repo.listCandidateAppearances(id);
  }

  reviewCandidate(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate> {
    return repo.reviewCandidate(id, notes, campaignId);
  }

  approveCandidate(id: string, campaignId?: string): Promise<SdrCandidate> {
    return repo.approveCandidate(id, campaignId);
  }

  discardCandidate(
    id: string,
    discardReasonId: string,
    notes?: string,
    campaignId?: string,
  ): Promise<SdrCandidate> {
    return repo.discardCandidate(id, discardReasonId, notes, campaignId);
  }

  reevaluateCandidate(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate> {
    return repo.reevaluateCandidate(id, notes, campaignId);
  }

  bulkCandidateAction(input: SdrBulkActionInput): Promise<SdrBulkActionSummary> {
    return repo.bulkCandidateAction(input);
  }

  // Etapa 2 — execução real (worker + Google Places).

  startCampaignRun(campaignId: string, input: StartSdrCampaignRunInput): Promise<SdrCampaignRun> {
    return repo.startCampaignRun(campaignId, input);
  }

  listCampaignRuns(campaignId: string): Promise<SdrCampaignRun[]> {
    return repo.listCampaignRuns(campaignId);
  }

  getCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return repo.getCampaignRun(runId);
  }

  listRunJobs(runId: string, status?: SdrDiscoveryJobStatus): Promise<SdrDiscoveryJob[]> {
    return repo.listRunJobs(runId, status);
  }

  pauseCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return repo.pauseCampaignRun(runId);
  }

  resumeCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return repo.resumeCampaignRun(runId);
  }

  cancelCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return repo.cancelCampaignRun(runId);
  }

  reprocessFailedJobs(runId: string): Promise<{ reprocessed: number }> {
    return repo.reprocessFailedJobs(runId);
  }

  getUsageSummary(limit?: number): Promise<SdrProviderUsageEntry[]> {
    return repo.getUsageSummary(limit);
  }

  // Etapa 3 — enriquecimento (CNPJ) + deduplicação forte.

  setCandidateCnpj(id: string, cnpj: string): Promise<SetCandidateCnpjResult> {
    return repo.setCandidateCnpj(id, cnpj);
  }

  refreshCandidateEnrichment(id: string, force?: boolean): Promise<SdrCandidate> {
    return repo.refreshCandidateEnrichment(id, force);
  }

  listCandidateEnrichments(id: string): Promise<SdrCandidateEnrichment[]> {
    return repo.listCandidateEnrichments(id);
  }

  listDuplicateSuggestions(
    id: string,
    status?: SdrDuplicateSuggestionStatus,
  ): Promise<SdrDuplicateSuggestion[]> {
    return repo.listDuplicateSuggestions(id, status);
  }

  confirmDuplicateSuggestion(candidateId: string, suggestionId: string): Promise<SdrDuplicateSuggestion> {
    return repo.confirmDuplicateSuggestion(candidateId, suggestionId);
  }

  dismissDuplicateSuggestion(candidateId: string, suggestionId: string): Promise<SdrDuplicateSuggestion> {
    return repo.dismissDuplicateSuggestion(candidateId, suggestionId);
  }

  // Etapa 4 — auditoria determinística de sites (sem análise comercial, sem IA).

  setCandidateWebsite(id: string, website: string): Promise<SdrCandidate> {
    return repo.setCandidateWebsite(id, website);
  }

  refreshCandidateAudit(id: string, force?: boolean): Promise<SdrCandidate> {
    return repo.refreshCandidateAudit(id, force);
  }

  listCandidateAudits(id: string): Promise<SdrCandidateAudit[]> {
    return repo.listCandidateAudits(id);
  }

  // Etapa 5 — Score GSM determinístico (sem IA/LLM).

  computeCandidateScore(id: string, ruleSet?: string): Promise<SdrCandidateScore> {
    return repo.computeCandidateScore(id, ruleSet);
  }

  listCandidateScores(id: string): Promise<SdrCandidateScore[]> {
    return repo.listCandidateScores(id);
  }

  computeCampaignScores(campaignId: string): Promise<{ enqueued: boolean }> {
    return repo.computeCampaignScores(campaignId);
  }

  // Etapa 6 — IA Comercial.

  generateCandidateOutreach(
    id: string,
    channel: SdrOutreachChannel,
    tone?: SdrOutreachTone,
  ): Promise<{ enqueued: boolean }> {
    return repo.generateCandidateOutreach(id, channel, tone);
  }

  listCandidateOutreachGenerations(id: string): Promise<SdrCandidateOutreachGeneration[]> {
    return repo.listCandidateOutreachGenerations(id);
  }

  // Etapa 7 — operação comercial ("Prospectar hoje").

  listProspectingQueue(filter?: SdrProspectingQueueFilter): Promise<SdrProspectSdrContext[]> {
    return repo.listProspectingQueue(filter);
  }

  getProspectOutreachContext(prospectId: string): Promise<SdrProspectSdrContext> {
    return repo.getProspectOutreachContext(prospectId);
  }

  // Etapa 8 — dashboard, funil real e custos.

  getDashboardOverview(): Promise<SdrDashboardOverview> {
    return repo.getDashboardOverview();
  }

  getDashboardCosts(): Promise<SdrProviderCostSummary[]> {
    return repo.getDashboardCosts();
  }
}

export const sdrService = new SdrService();
