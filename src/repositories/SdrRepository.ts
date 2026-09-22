import type {
  CreateSdrCampaignInput,
  CreateSdrCoverageInput,
  CreateSdrDiscardReasonInput,
  CreateSdrIcpPresetInput,
  SdrBulkActionInput,
  SdrBulkActionSummary,
  SdrCampaign,
  SdrCandidate,
  SdrCandidateAppearance,
  SdrCandidateDecision,
  SdrCandidateListFilter,
  SdrCoverage,
  SdrDiscardReason,
  SdrIcpPreset,
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
}
