import type { SdrRepository } from "../SdrRepository";
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
  SdrDashboardOverview,
  SdrProviderCostSummary,
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
  SdrSearchTermCatalog,
} from "../../types/sdr";
import type { Page } from "../../types/common";
import { NotImplementedError } from "../../utils/errors";

const REASON =
  "SDR é a operação de pré-prospecção interna da GSM Automação — não faz parte da demonstração pública do CRM.";

/** Mesmo racional de `ProspectsMockRepository`/`ClientsMockRepository`: o
 * backend já tem o módulo completo, mas ele nunca aparece no modo Demo
 * (dado comercial interno da GSM). */
export class SdrMockRepository implements SdrRepository {
  async listCampaigns(): Promise<SdrCampaign[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async getCampaign(): Promise<SdrCampaign> {
    throw new NotImplementedError("SDR", REASON);
  }

  async createCampaign(_input: CreateSdrCampaignInput): Promise<SdrCampaign> {
    throw new NotImplementedError("SDR", REASON);
  }

  async updateCampaign(_id: string, _input: UpdateSdrCampaignInput): Promise<SdrCampaign> {
    throw new NotImplementedError("SDR", REASON);
  }

  async deleteCampaign(): Promise<void> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listSearchTerms(_provider: string): Promise<SdrSearchTermCatalog> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listIcpPresets(): Promise<SdrIcpPreset[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async createIcpPreset(_input: CreateSdrIcpPresetInput): Promise<SdrIcpPreset> {
    throw new NotImplementedError("SDR", REASON);
  }

  async updateIcpPreset(_id: string, _input: UpdateSdrIcpPresetInput): Promise<SdrIcpPreset> {
    throw new NotImplementedError("SDR", REASON);
  }

  async deleteIcpPreset(): Promise<void> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listDiscardReasons(): Promise<SdrDiscardReason[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async createDiscardReason(_input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason> {
    throw new NotImplementedError("SDR", REASON);
  }

  async updateDiscardReason(
    _id: string,
    _input: CreateSdrDiscardReasonInput,
  ): Promise<SdrDiscardReason> {
    throw new NotImplementedError("SDR", REASON);
  }

  async deleteDiscardReason(): Promise<void> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCoverage(): Promise<SdrCoverage[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async createCoverage(_input: CreateSdrCoverageInput): Promise<SdrCoverage> {
    throw new NotImplementedError("SDR", REASON);
  }

  async updateCoverage(_id: string, _input: UpdateSdrCoverageInput): Promise<SdrCoverage> {
    throw new NotImplementedError("SDR", REASON);
  }

  async deleteCoverage(): Promise<void> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidates(_filter: SdrCandidateListFilter): Promise<Page<SdrCandidate>> {
    throw new NotImplementedError("SDR", REASON);
  }

  async getCandidate(): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidateDecisions(): Promise<SdrCandidateDecision[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidateAppearances(): Promise<SdrCandidateAppearance[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async reviewCandidate(): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async approveCandidate(): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async discardCandidate(): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async reevaluateCandidate(): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async bulkCandidateAction(_input: SdrBulkActionInput): Promise<SdrBulkActionSummary> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 2 — execução real (worker + Google Places).

  async startCampaignRun(
    _campaignId: string,
    _input: StartSdrCampaignRunInput,
  ): Promise<SdrCampaignRun> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCampaignRuns(): Promise<SdrCampaignRun[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async getCampaignRun(): Promise<SdrCampaignRun> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listRunJobs(_runId: string, _status?: SdrDiscoveryJobStatus): Promise<SdrDiscoveryJob[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async pauseCampaignRun(): Promise<SdrCampaignRun> {
    throw new NotImplementedError("SDR", REASON);
  }

  async resumeCampaignRun(): Promise<SdrCampaignRun> {
    throw new NotImplementedError("SDR", REASON);
  }

  async cancelCampaignRun(): Promise<SdrCampaignRun> {
    throw new NotImplementedError("SDR", REASON);
  }

  async reprocessFailedJobs(): Promise<{ reprocessed: number }> {
    throw new NotImplementedError("SDR", REASON);
  }

  async getUsageSummary(): Promise<SdrProviderUsageEntry[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 3 — enriquecimento (CNPJ) + deduplicação forte.

  async setCandidateCnpj(_id: string, _cnpj: string): Promise<SetCandidateCnpjResult> {
    throw new NotImplementedError("SDR", REASON);
  }

  async refreshCandidateEnrichment(_id: string, _force?: boolean): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidateEnrichments(): Promise<SdrCandidateEnrichment[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listDuplicateSuggestions(
    _id: string,
    _status?: SdrDuplicateSuggestionStatus,
  ): Promise<SdrDuplicateSuggestion[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async confirmDuplicateSuggestion(): Promise<SdrDuplicateSuggestion> {
    throw new NotImplementedError("SDR", REASON);
  }

  async dismissDuplicateSuggestion(): Promise<SdrDuplicateSuggestion> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 4 — auditoria determinística de sites (sem análise comercial, sem IA).

  async setCandidateWebsite(_id: string, _website: string): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async refreshCandidateAudit(_id: string, _force?: boolean): Promise<SdrCandidate> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidateAudits(): Promise<SdrCandidateAudit[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 5 — Score GSM determinístico (sem IA/LLM).

  async computeCandidateScore(_id: string, _ruleSet?: string): Promise<SdrCandidateScore> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidateScores(): Promise<SdrCandidateScore[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async computeCampaignScores(): Promise<{ enqueued: boolean }> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 6 — IA Comercial.

  async generateCandidateOutreach(
    _id: string,
    _channel: SdrOutreachChannel,
    _tone?: SdrOutreachTone,
  ): Promise<{ enqueued: boolean }> {
    throw new NotImplementedError("SDR", REASON);
  }

  async listCandidateOutreachGenerations(): Promise<SdrCandidateOutreachGeneration[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 7 — operação comercial ("Prospectar hoje").

  async listProspectingQueue(): Promise<SdrProspectSdrContext[]> {
    throw new NotImplementedError("SDR", REASON);
  }

  async getProspectOutreachContext(): Promise<SdrProspectSdrContext> {
    throw new NotImplementedError("SDR", REASON);
  }

  // Etapa 8 — dashboard, funil real e custos.

  async getDashboardOverview(): Promise<SdrDashboardOverview> {
    throw new NotImplementedError("SDR", REASON);
  }

  async getDashboardCosts(): Promise<SdrProviderCostSummary[]> {
    throw new NotImplementedError("SDR", REASON);
  }
}
