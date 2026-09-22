import type { SdrRepository } from "../SdrRepository";
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
}
