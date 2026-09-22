import type { SdrRepository } from "../SdrRepository";
import type {
  CreateSdrCampaignInput,
  CreateSdrCoverageInput,
  CreateSdrDiscardReasonInput,
  CreateSdrIcpPresetInput,
  SdrBulkActionInput,
  SdrBulkActionSummary,
  SdrCampaign,
  SdrCampaignCriterion,
  SdrCampaignLocation,
  SdrCandidate,
  SdrCandidateAppearance,
  SdrCandidateDecision,
  SdrCandidateListFilter,
  SdrCoverage,
  SdrCriterion,
  SdrCriterionKind,
  SdrDiscardReason,
  SdrIcpPreset,
  SdrLocation,
  UpdateSdrCampaignInput,
  UpdateSdrCoverageInput,
  UpdateSdrIcpPresetInput,
} from "../../types/sdr";
import type { Page } from "../../types/common";
import { apiRequest } from "./ApiClient";

interface DiscardReasonDto {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface IcpPresetDto {
  id: string;
  name: string;
  niche: string;
  search_terms: string[];
  gsm_offers: string[];
  locations: SdrLocation[];
  criteria: SdrCriterion[];
  created_at: string;
  updated_at: string;
}

interface CampaignLocationDto {
  id: string;
  campaign_id: string;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
}

interface CampaignCriterionDto {
  id: string;
  campaign_id: string;
  kind: SdrCriterionKind;
  key: string;
  value: string;
  weight: number | null;
}

interface CampaignDto {
  id: string;
  name: string;
  niche: string;
  search_terms: string[];
  gsm_offers: string[];
  target_quantity: number;
  provider: string;
  status: SdrCampaign["status"];
  created_from_preset_id: string | null;
  locations: CampaignLocationDto[];
  criteria: CampaignCriterionDto[];
  created_at: string;
  updated_at: string;
}

interface CoverageDto {
  id: string;
  niche: string;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  provider: string;
  search_terms_used: string[] | null;
  status: SdrCoverage["status"];
  quantity_processed: number;
  searched_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CandidateDto {
  id: string;
  company_name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  google_maps_url: string | null;
  niche: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  status: SdrCandidate["status"];
  discard_reason_id: string | null;
  known_duplicate_prospect_id: string | null;
  known_duplicate_client_id: string | null;
  approved_prospect_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AppearanceDto {
  id: string;
  candidate_id: string;
  campaign_id: string;
  first_seen_at: string;
  last_seen_at: string;
  times_seen: number;
  score: number | null;
}

interface DecisionDto {
  id: string;
  candidate_id: string;
  campaign_id: string | null;
  decision: SdrCandidateDecision["decision"];
  from_status: SdrCandidateDecision["fromStatus"];
  to_status: SdrCandidateDecision["toStatus"];
  discard_reason_id: string | null;
  notes: string | null;
  actor_user_id: string | null;
  created_at: string;
}

interface BulkRowDto {
  candidate_id: string;
  outcome: "ok" | "error";
  detail: string | null;
}

interface BulkSummaryDto {
  total: number;
  ok: number;
  errors: number;
  rows: BulkRowDto[];
}

function toDiscardReason(dto: DiscardReasonDto): SdrDiscardReason {
  return { id: dto.id, name: dto.name, createdAt: dto.created_at, updatedAt: dto.updated_at };
}

function toIcpPreset(dto: IcpPresetDto): SdrIcpPreset {
  return {
    id: dto.id,
    name: dto.name,
    niche: dto.niche,
    searchTerms: dto.search_terms,
    gsmOffers: dto.gsm_offers,
    locations: dto.locations,
    criteria: dto.criteria,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toCampaignLocation(dto: CampaignLocationDto): SdrCampaignLocation {
  return {
    id: dto.id,
    campaignId: dto.campaign_id,
    country: dto.country,
    state: dto.state,
    city: dto.city,
    locality: dto.locality,
  };
}

function toCampaignCriterion(dto: CampaignCriterionDto): SdrCampaignCriterion {
  return {
    id: dto.id,
    campaignId: dto.campaign_id,
    kind: dto.kind,
    key: dto.key,
    value: dto.value,
    weight: dto.weight,
  };
}

function toCampaign(dto: CampaignDto): SdrCampaign {
  return {
    id: dto.id,
    name: dto.name,
    niche: dto.niche,
    searchTerms: dto.search_terms,
    gsmOffers: dto.gsm_offers,
    targetQuantity: dto.target_quantity,
    provider: dto.provider,
    status: dto.status,
    createdFromPresetId: dto.created_from_preset_id,
    locations: dto.locations.map(toCampaignLocation),
    criteria: dto.criteria.map(toCampaignCriterion),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toCoverage(dto: CoverageDto): SdrCoverage {
  return {
    id: dto.id,
    niche: dto.niche,
    country: dto.country,
    state: dto.state,
    city: dto.city,
    locality: dto.locality,
    provider: dto.provider,
    searchTermsUsed: dto.search_terms_used,
    status: dto.status,
    quantityProcessed: dto.quantity_processed,
    searchedAt: dto.searched_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toCandidate(dto: CandidateDto): SdrCandidate {
  return {
    id: dto.id,
    companyName: dto.company_name,
    phoneRaw: dto.phone_raw,
    phoneNormalized: dto.phone_normalized,
    googleMapsUrl: dto.google_maps_url,
    niche: dto.niche,
    country: dto.country,
    state: dto.state,
    city: dto.city,
    locality: dto.locality,
    status: dto.status,
    discardReasonId: dto.discard_reason_id,
    knownDuplicateProspectId: dto.known_duplicate_prospect_id,
    knownDuplicateClientId: dto.known_duplicate_client_id,
    approvedProspectId: dto.approved_prospect_id,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toAppearance(dto: AppearanceDto): SdrCandidateAppearance {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    campaignId: dto.campaign_id,
    firstSeenAt: dto.first_seen_at,
    lastSeenAt: dto.last_seen_at,
    timesSeen: dto.times_seen,
    score: dto.score,
  };
}

function toDecision(dto: DecisionDto): SdrCandidateDecision {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    campaignId: dto.campaign_id,
    decision: dto.decision,
    fromStatus: dto.from_status,
    toStatus: dto.to_status,
    discardReasonId: dto.discard_reason_id,
    notes: dto.notes,
    actorUserId: dto.actor_user_id,
    createdAt: dto.created_at,
  };
}

function toSummary(dto: BulkSummaryDto): SdrBulkActionSummary {
  return {
    total: dto.total,
    ok: dto.ok,
    errors: dto.errors,
    rows: dto.rows.map((r) => ({ candidateId: r.candidate_id, outcome: r.outcome, detail: r.detail })),
  };
}

function campaignBody(input: CreateSdrCampaignInput | UpdateSdrCampaignInput) {
  return {
    name: input.name,
    niche: input.niche,
    locations: input.locations,
    search_terms: input.searchTerms,
    gsm_offers: input.gsmOffers,
    criteria: input.criteria,
    target_quantity: input.targetQuantity,
    provider: input.provider,
    status: input.status,
    ...("fromPresetId" in input ? { from_preset_id: input.fromPresetId } : {}),
  };
}

export class SdrApiRepository implements SdrRepository {
  async listCampaigns(status?: string, niche?: string, search?: string): Promise<SdrCampaign[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (niche) params.set("niche", niche);
    if (search) params.set("search", search);
    const query = params.toString();
    const dto = await apiRequest<CampaignDto[]>(
      `/api/v1/sdr/campaigns${query ? `?${query}` : ""}`,
    );
    return dto.map(toCampaign);
  }

  async getCampaign(id: string): Promise<SdrCampaign> {
    return toCampaign(await apiRequest<CampaignDto>(`/api/v1/sdr/campaigns/${id}`));
  }

  async createCampaign(input: CreateSdrCampaignInput): Promise<SdrCampaign> {
    return toCampaign(
      await apiRequest<CampaignDto>("/api/v1/sdr/campaigns", {
        method: "POST",
        body: JSON.stringify(campaignBody(input)),
      }),
    );
  }

  async updateCampaign(id: string, input: UpdateSdrCampaignInput): Promise<SdrCampaign> {
    return toCampaign(
      await apiRequest<CampaignDto>(`/api/v1/sdr/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(campaignBody(input)),
      }),
    );
  }

  async deleteCampaign(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/sdr/campaigns/${id}`, { method: "DELETE" });
  }

  async listIcpPresets(): Promise<SdrIcpPreset[]> {
    const dto = await apiRequest<IcpPresetDto[]>("/api/v1/sdr/icp-presets");
    return dto.map(toIcpPreset);
  }

  async createIcpPreset(input: CreateSdrIcpPresetInput): Promise<SdrIcpPreset> {
    return toIcpPreset(
      await apiRequest<IcpPresetDto>("/api/v1/sdr/icp-presets", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          niche: input.niche,
          search_terms: input.searchTerms ?? [],
          gsm_offers: input.gsmOffers ?? [],
          locations: input.locations ?? [],
          criteria: input.criteria ?? [],
        }),
      }),
    );
  }

  async updateIcpPreset(id: string, input: UpdateSdrIcpPresetInput): Promise<SdrIcpPreset> {
    return toIcpPreset(
      await apiRequest<IcpPresetDto>(`/api/v1/sdr/icp-presets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          niche: input.niche,
          search_terms: input.searchTerms,
          gsm_offers: input.gsmOffers,
          locations: input.locations,
          criteria: input.criteria,
        }),
      }),
    );
  }

  async deleteIcpPreset(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/sdr/icp-presets/${id}`, { method: "DELETE" });
  }

  async listDiscardReasons(): Promise<SdrDiscardReason[]> {
    const dto = await apiRequest<DiscardReasonDto[]>("/api/v1/sdr/discard-reasons");
    return dto.map(toDiscardReason);
  }

  async createDiscardReason(input: CreateSdrDiscardReasonInput): Promise<SdrDiscardReason> {
    return toDiscardReason(
      await apiRequest<DiscardReasonDto>("/api/v1/sdr/discard-reasons", {
        method: "POST",
        body: JSON.stringify({ name: input.name }),
      }),
    );
  }

  async updateDiscardReason(
    id: string,
    input: CreateSdrDiscardReasonInput,
  ): Promise<SdrDiscardReason> {
    return toDiscardReason(
      await apiRequest<DiscardReasonDto>(`/api/v1/sdr/discard-reasons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: input.name }),
      }),
    );
  }

  async deleteDiscardReason(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/sdr/discard-reasons/${id}`, { method: "DELETE" });
  }

  async listCoverage(): Promise<SdrCoverage[]> {
    const dto = await apiRequest<CoverageDto[]>("/api/v1/sdr/coverage");
    return dto.map(toCoverage);
  }

  async createCoverage(input: CreateSdrCoverageInput): Promise<SdrCoverage> {
    return toCoverage(
      await apiRequest<CoverageDto>("/api/v1/sdr/coverage", {
        method: "POST",
        body: JSON.stringify({
          niche: input.niche,
          provider: input.provider,
          country: input.country,
          state: input.state,
          city: input.city,
          locality: input.locality,
          search_terms_used: input.searchTermsUsed,
          status: input.status,
        }),
      }),
    );
  }

  async updateCoverage(id: string, input: UpdateSdrCoverageInput): Promise<SdrCoverage> {
    return toCoverage(
      await apiRequest<CoverageDto>(`/api/v1/sdr/coverage/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: input.status,
          quantity_processed: input.quantityProcessed,
          search_terms_used: input.searchTermsUsed,
        }),
      }),
    );
  }

  async deleteCoverage(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/sdr/coverage/${id}`, { method: "DELETE" });
  }

  async listCandidates(filter: SdrCandidateListFilter): Promise<Page<SdrCandidate>> {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.campaignId) params.set("campaign_id", filter.campaignId);
    if (filter.niche) params.set("niche", filter.niche);
    if (filter.search) params.set("search", filter.search);
    params.set("page", String(filter.page ?? 1));
    params.set("page_size", String(filter.pageSize ?? 20));
    const dto = await apiRequest<{
      items: CandidateDto[];
      total: number;
      page: number;
      page_size: number;
    }>(`/api/v1/sdr/candidates?${params.toString()}`);
    return {
      items: dto.items.map(toCandidate),
      total: dto.total,
      page: dto.page,
      pageSize: dto.page_size,
    };
  }

  async getCandidate(id: string): Promise<SdrCandidate> {
    return toCandidate(await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}`));
  }

  async listCandidateDecisions(id: string): Promise<SdrCandidateDecision[]> {
    const dto = await apiRequest<DecisionDto[]>(`/api/v1/sdr/candidates/${id}/decisions`);
    return dto.map(toDecision);
  }

  async listCandidateAppearances(id: string): Promise<SdrCandidateAppearance[]> {
    const dto = await apiRequest<AppearanceDto[]>(`/api/v1/sdr/candidates/${id}/appearances`);
    return dto.map(toAppearance);
  }

  async reviewCandidate(id: string, notes?: string, campaignId?: string): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ notes, campaign_id: campaignId }),
      }),
    );
  }

  async approveCandidate(id: string, campaignId?: string): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ campaign_id: campaignId }),
      }),
    );
  }

  async discardCandidate(
    id: string,
    discardReasonId: string,
    notes?: string,
    campaignId?: string,
  ): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/discard`, {
        method: "POST",
        body: JSON.stringify({ discard_reason_id: discardReasonId, notes, campaign_id: campaignId }),
      }),
    );
  }

  async reevaluateCandidate(
    id: string,
    notes?: string,
    campaignId?: string,
  ): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/reevaluate`, {
        method: "POST",
        body: JSON.stringify({ notes, campaign_id: campaignId }),
      }),
    );
  }

  async bulkCandidateAction(input: SdrBulkActionInput): Promise<SdrBulkActionSummary> {
    return toSummary(
      await apiRequest<BulkSummaryDto>("/api/v1/sdr/candidates/bulk", {
        method: "POST",
        body: JSON.stringify({
          action: input.action,
          candidate_ids: input.candidateIds,
          discard_reason_id: input.discardReasonId,
          notes: input.notes,
        }),
      }),
    );
  }
}
