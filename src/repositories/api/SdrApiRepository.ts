import type { SdrRepository } from "../SdrRepository";
import type {
  CreateSdrCampaignInput,
  CreateSdrCoverageInput,
  CreateSdrDiscardReasonInput,
  CreateSdrIcpPresetInput,
  SdrAuditPageCheck,
  SdrBulkActionInput,
  SdrBulkActionSummary,
  SdrCampaign,
  SdrCampaignCriterion,
  SdrCampaignLocation,
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
  SdrScoreOutcomeBucket,
  SdrProviderCostSummary,
  SdrSearchTermCatalog,
  SdrCoverage,
  SdrCriterion,
  SdrCriterionKind,
  SdrDiscardReason,
  SdrDiscoveryJob,
  SdrDiscoveryJobStatus,
  SdrDuplicateSuggestion,
  SdrDuplicateSuggestionStatus,
  SdrIcpPreset,
  SdrLocation,
  SdrProviderUsageEntry,
  SetCandidateCnpjResult,
  StartSdrCampaignRunInput,
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
  provider_ref: string | null;
  cnpj: string | null;
  domain: string | null;
  email: string | null;
  instagram_handle: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  capital_social_cents: number | null;
  last_enrichment_at: string | null;
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
    providerRef: dto.provider_ref,
    cnpj: dto.cnpj,
    domain: dto.domain,
    email: dto.email,
    instagramHandle: dto.instagram_handle,
    razaoSocial: dto.razao_social,
    nomeFantasia: dto.nome_fantasia,
    cnae: dto.cnae,
    situacaoCadastral: dto.situacao_cadastral,
    dataAbertura: dto.data_abertura,
    capitalSocialCents: dto.capital_social_cents,
    lastEnrichmentAt: dto.last_enrichment_at,
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

interface CampaignRunDto {
  id: string;
  tenant_id: string;
  campaign_id: string;
  mode: SdrCampaignRun["mode"];
  status: SdrCampaignRun["status"];
  target_quantity: number;
  max_provider_calls: number | null;
  found_count: number;
  duplicate_count: number;
  processed_count: number;
  failure_count: number;
  current_stage: string | null;
  actor_user_id: string | null;
  started_at: string | null;
  paused_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DiscoveryJobDto {
  id: string;
  run_id: string;
  campaign_id: string;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  search_term: string;
  page_token: string | null;
  status: SdrDiscoveryJob["status"];
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProviderUsageEntryDto {
  id: string;
  campaign_id: string | null;
  run_id: string | null;
  provider: string;
  sku: string;
  field_mask: string;
  units: number;
  estimated_cost_cents: number | null;
  created_at: string;
}

function toCampaignRun(dto: CampaignRunDto): SdrCampaignRun {
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    campaignId: dto.campaign_id,
    mode: dto.mode,
    status: dto.status,
    targetQuantity: dto.target_quantity,
    maxProviderCalls: dto.max_provider_calls,
    foundCount: dto.found_count,
    duplicateCount: dto.duplicate_count,
    processedCount: dto.processed_count,
    failureCount: dto.failure_count,
    currentStage: dto.current_stage,
    actorUserId: dto.actor_user_id,
    startedAt: dto.started_at,
    pausedAt: dto.paused_at,
    finishedAt: dto.finished_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toDiscoveryJob(dto: DiscoveryJobDto): SdrDiscoveryJob {
  return {
    id: dto.id,
    runId: dto.run_id,
    campaignId: dto.campaign_id,
    country: dto.country,
    state: dto.state,
    city: dto.city,
    locality: dto.locality,
    searchTerm: dto.search_term,
    pageToken: dto.page_token,
    status: dto.status,
    attempts: dto.attempts,
    maxAttempts: dto.max_attempts,
    lastError: dto.last_error,
    startedAt: dto.started_at,
    finishedAt: dto.finished_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toProviderUsageEntry(dto: ProviderUsageEntryDto): SdrProviderUsageEntry {
  return {
    id: dto.id,
    campaignId: dto.campaign_id,
    runId: dto.run_id,
    provider: dto.provider,
    sku: dto.sku,
    fieldMask: dto.field_mask,
    units: dto.units,
    estimatedCostCents: dto.estimated_cost_cents,
    createdAt: dto.created_at,
  };
}

interface EnrichmentDto {
  id: string;
  candidate_id: string;
  source: SdrCandidateEnrichment["source"];
  status: SdrCandidateEnrichment["status"];
  confidence: SdrCandidateEnrichment["confidence"];
  cnpj_queried: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  capital_social_cents: number | null;
  email: string | null;
  error_detail: string | null;
  fetched_at: string;
  created_at: string;
}

interface DuplicateSuggestionDto {
  id: string;
  candidate_id: string;
  target_type: SdrDuplicateSuggestion["targetType"];
  target_id: string;
  signal: SdrDuplicateSuggestion["signal"];
  confidence: SdrDuplicateSuggestion["confidence"];
  status: SdrDuplicateSuggestion["status"];
  detected_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
}

function toEnrichment(dto: EnrichmentDto): SdrCandidateEnrichment {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    source: dto.source,
    status: dto.status,
    confidence: dto.confidence,
    cnpjQueried: dto.cnpj_queried,
    razaoSocial: dto.razao_social,
    nomeFantasia: dto.nome_fantasia,
    cnae: dto.cnae,
    situacaoCadastral: dto.situacao_cadastral,
    dataAbertura: dto.data_abertura,
    capitalSocialCents: dto.capital_social_cents,
    email: dto.email,
    errorDetail: dto.error_detail,
    fetchedAt: dto.fetched_at,
    createdAt: dto.created_at,
  };
}

function toDuplicateSuggestion(dto: DuplicateSuggestionDto): SdrDuplicateSuggestion {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    targetType: dto.target_type,
    targetId: dto.target_id,
    signal: dto.signal,
    confidence: dto.confidence,
    status: dto.status,
    detectedAt: dto.detected_at,
    resolvedAt: dto.resolved_at,
    resolvedByUserId: dto.resolved_by_user_id,
    createdAt: dto.created_at,
  };
}

interface AuditPageCheckDto {
  url: string;
  page_kind: string;
  ok: boolean;
  http_status: number | null;
  error: string | null;
}

interface AuditSignalValueDto {
  value: unknown;
  evidence: string;
  source_url: string;
}

interface AuditDto {
  id: string;
  candidate_id: string;
  auditor_version: number;
  status: SdrCandidateAudit["status"];
  signals: Record<string, AuditSignalValueDto>;
  pages_checked: AuditPageCheckDto[];
  pagespeed: SdrCandidateAudit["pagespeed"];
  started_at: string;
  finished_at: string;
  created_at: string;
}

function toAuditPageCheck(dto: AuditPageCheckDto): SdrAuditPageCheck {
  return {
    url: dto.url,
    pageKind: dto.page_kind,
    ok: dto.ok,
    httpStatus: dto.http_status,
    error: dto.error,
  };
}

function toAudit(dto: AuditDto): SdrCandidateAudit {
  const signals: SdrCandidateAudit["signals"] = {};
  for (const [key, value] of Object.entries(dto.signals)) {
    signals[key] = { value: value.value, evidence: value.evidence, sourceUrl: value.source_url };
  }
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    auditorVersion: dto.auditor_version,
    status: dto.status,
    signals,
    pagesChecked: dto.pages_checked.map(toAuditPageCheck),
    pagespeed: dto.pagespeed,
    startedAt: dto.started_at,
    finishedAt: dto.finished_at,
    createdAt: dto.created_at,
  };
}

interface ScoreDto {
  id: string;
  candidate_id: string;
  rule_set: string;
  total: number;
  commercial_potential: number;
  digital_gap: number;
  gsm_fit: number;
  priority: SdrCandidateScore["priority"];
  breakdown: SdrCandidateScore["breakdown"];
  computed_at: string;
  created_at: string;
}

function toScore(dto: ScoreDto): SdrCandidateScore {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    ruleSet: dto.rule_set,
    total: dto.total,
    commercialPotential: dto.commercial_potential,
    digitalGap: dto.digital_gap,
    gsmFit: dto.gsm_fit,
    priority: dto.priority,
    breakdown: dto.breakdown,
    computedAt: dto.computed_at,
    createdAt: dto.created_at,
  };
}

interface OutreachGenerationDto {
  id: string;
  candidate_id: string;
  score_id: string | null;
  prompt_version: string;
  model: string;
  channel: SdrOutreachChannel;
  tone: SdrOutreachTone;
  status: SdrCandidateOutreachGeneration["status"];
  analysis: SdrCandidateOutreachGeneration["analysis"];
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_cents: number | null;
  error_detail: string | null;
  created_at: string;
}

function toOutreachGeneration(dto: OutreachGenerationDto): SdrCandidateOutreachGeneration {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    scoreId: dto.score_id,
    promptVersion: dto.prompt_version,
    model: dto.model,
    channel: dto.channel,
    tone: dto.tone,
    status: dto.status,
    analysis: dto.analysis,
    inputTokens: dto.input_tokens,
    outputTokens: dto.output_tokens,
    estimatedCostCents: dto.estimated_cost_cents,
    errorDetail: dto.error_detail,
    createdAt: dto.created_at,
  };
}

interface ProspectSdrContextDto {
  prospect_id: string;
  company_name: string;
  phone_raw: string | null;
  city: string | null;
  niche: string | null;
  google_maps_url: string | null;
  candidate_id: string | null;
  score_total: number | null;
  score_priority: SdrProspectSdrContext["scorePriority"];
  outreach_channel: SdrOutreachChannel | null;
  outreach_message: string | null;
  outreach_hook: string | null;
  outreach_opportunities: string[] | null;
}

function toProspectSdrContext(dto: ProspectSdrContextDto): SdrProspectSdrContext {
  return {
    prospectId: dto.prospect_id,
    companyName: dto.company_name,
    phoneRaw: dto.phone_raw,
    city: dto.city,
    niche: dto.niche,
    googleMapsUrl: dto.google_maps_url,
    candidateId: dto.candidate_id,
    scoreTotal: dto.score_total,
    scorePriority: dto.score_priority,
    outreachChannel: dto.outreach_channel,
    outreachMessage: dto.outreach_message,
    outreachHook: dto.outreach_hook,
    outreachOpportunities: dto.outreach_opportunities,
  };
}

interface FunnelStageDistributionDto {
  stage_id: string;
  stage_name: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
  count: number;
}

interface FunnelSummaryDto {
  encontrados: number;
  qualificados: number;
  aprovados: number;
  contatados: number;
  ganhos: number;
  perdidos: number;
  stage_distribution: FunnelStageDistributionDto[];
}

interface ScoreOutcomeBucketDto {
  priority: SdrScoreOutcomeBucket["priority"];
  aprovados: number;
  contatados: number;
  ganhos: number;
  perdidos: number;
  taxa_contato: number | null;
  taxa_ganho: number | null;
}

interface InsightDto {
  text: string;
  sample_size: number;
}

interface DashboardOverviewDto {
  funnel: FunnelSummaryDto;
  score_outcome: ScoreOutcomeBucketDto[];
  insights: InsightDto[];
}

function toDashboardOverview(dto: DashboardOverviewDto): SdrDashboardOverview {
  return {
    funnel: {
      encontrados: dto.funnel.encontrados,
      qualificados: dto.funnel.qualificados,
      aprovados: dto.funnel.aprovados,
      contatados: dto.funnel.contatados,
      ganhos: dto.funnel.ganhos,
      perdidos: dto.funnel.perdidos,
      stageDistribution: dto.funnel.stage_distribution.map((item) => ({
        stageId: item.stage_id,
        stageName: item.stage_name,
        order: item.order,
        isWon: item.is_won,
        isLost: item.is_lost,
        count: item.count,
      })),
    },
    scoreOutcome: dto.score_outcome.map((bucket) => ({
      priority: bucket.priority,
      aprovados: bucket.aprovados,
      contatados: bucket.contatados,
      ganhos: bucket.ganhos,
      perdidos: bucket.perdidos,
      taxaContato: bucket.taxa_contato,
      taxaGanho: bucket.taxa_ganho,
    })),
    insights: dto.insights.map((insight) => ({ text: insight.text, sampleSize: insight.sample_size })),
  };
}

interface ProviderCostSummaryDto {
  provider: string;
  total_units: number;
  total_cost_cents: number;
  calls_count: number;
}

function toProviderCostSummary(dto: ProviderCostSummaryDto): SdrProviderCostSummary {
  return {
    provider: dto.provider,
    totalUnits: dto.total_units,
    totalCostCents: dto.total_cost_cents,
    callsCount: dto.calls_count,
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

  async listSearchTerms(provider: string): Promise<SdrSearchTermCatalog> {
    const dto = await apiRequest<{ provider: string; free_text: boolean; terms: string[] }>(
      `/api/v1/sdr/search-terms?provider=${encodeURIComponent(provider)}`,
    );
    return { provider: dto.provider, freeText: dto.free_text, terms: dto.terms };
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

  // Etapa 2 — execução real (worker + Google Places).

  async startCampaignRun(
    campaignId: string,
    input: StartSdrCampaignRunInput,
  ): Promise<SdrCampaignRun> {
    return toCampaignRun(
      await apiRequest<CampaignRunDto>(`/api/v1/sdr/campaigns/${campaignId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          mode: input.mode,
          target_quantity: input.targetQuantity,
          max_provider_calls: input.maxProviderCalls,
        }),
      }),
    );
  }

  async listCampaignRuns(campaignId: string): Promise<SdrCampaignRun[]> {
    const dto = await apiRequest<CampaignRunDto[]>(`/api/v1/sdr/campaigns/${campaignId}/runs`);
    return dto.map(toCampaignRun);
  }

  async getCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return toCampaignRun(await apiRequest<CampaignRunDto>(`/api/v1/sdr/runs/${runId}`));
  }

  async listRunJobs(runId: string, status?: SdrDiscoveryJobStatus): Promise<SdrDiscoveryJob[]> {
    const query = status ? `?status=${status}` : "";
    const dto = await apiRequest<DiscoveryJobDto[]>(`/api/v1/sdr/runs/${runId}/jobs${query}`);
    return dto.map(toDiscoveryJob);
  }

  async pauseCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return toCampaignRun(
      await apiRequest<CampaignRunDto>(`/api/v1/sdr/runs/${runId}/pause`, { method: "POST" }),
    );
  }

  async resumeCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return toCampaignRun(
      await apiRequest<CampaignRunDto>(`/api/v1/sdr/runs/${runId}/resume`, { method: "POST" }),
    );
  }

  async cancelCampaignRun(runId: string): Promise<SdrCampaignRun> {
    return toCampaignRun(
      await apiRequest<CampaignRunDto>(`/api/v1/sdr/runs/${runId}/cancel`, { method: "POST" }),
    );
  }

  async reprocessFailedJobs(runId: string): Promise<{ reprocessed: number }> {
    return await apiRequest<{ reprocessed: number }>(
      `/api/v1/sdr/runs/${runId}/reprocess-failed`,
      { method: "POST" },
    );
  }

  async getUsageSummary(limit?: number): Promise<SdrProviderUsageEntry[]> {
    const query = limit ? `?limit=${limit}` : "";
    const dto = await apiRequest<ProviderUsageEntryDto[]>(`/api/v1/sdr/usage${query}`);
    return dto.map(toProviderUsageEntry);
  }

  // Etapa 3 — enriquecimento (CNPJ) + deduplicação forte.

  async setCandidateCnpj(id: string, cnpj: string): Promise<SetCandidateCnpjResult> {
    const dto = await apiRequest<{ candidate: CandidateDto; check_digits_valid: boolean }>(
      `/api/v1/sdr/candidates/${id}/cnpj`,
      { method: "PATCH", body: JSON.stringify({ cnpj }) },
    );
    return { candidate: toCandidate(dto.candidate), checkDigitsValid: dto.check_digits_valid };
  }

  async refreshCandidateEnrichment(id: string, force?: boolean): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/enrichment/refresh`, {
        method: "POST",
        body: JSON.stringify({ force: force ?? false }),
      }),
    );
  }

  async listCandidateEnrichments(id: string): Promise<SdrCandidateEnrichment[]> {
    const dto = await apiRequest<EnrichmentDto[]>(`/api/v1/sdr/candidates/${id}/enrichment`);
    return dto.map(toEnrichment);
  }

  async listDuplicateSuggestions(
    id: string,
    status?: SdrDuplicateSuggestionStatus,
  ): Promise<SdrDuplicateSuggestion[]> {
    const query = status ? `?status=${status}` : "";
    const dto = await apiRequest<DuplicateSuggestionDto[]>(
      `/api/v1/sdr/candidates/${id}/duplicate-suggestions${query}`,
    );
    return dto.map(toDuplicateSuggestion);
  }

  async confirmDuplicateSuggestion(
    candidateId: string,
    suggestionId: string,
  ): Promise<SdrDuplicateSuggestion> {
    return toDuplicateSuggestion(
      await apiRequest<DuplicateSuggestionDto>(
        `/api/v1/sdr/candidates/${candidateId}/duplicate-suggestions/${suggestionId}/confirm`,
        { method: "POST" },
      ),
    );
  }

  async dismissDuplicateSuggestion(
    candidateId: string,
    suggestionId: string,
  ): Promise<SdrDuplicateSuggestion> {
    return toDuplicateSuggestion(
      await apiRequest<DuplicateSuggestionDto>(
        `/api/v1/sdr/candidates/${candidateId}/duplicate-suggestions/${suggestionId}/dismiss`,
        { method: "POST" },
      ),
    );
  }

  // Etapa 4 — auditoria determinística de sites (sem análise comercial, sem IA).

  async setCandidateWebsite(id: string, website: string): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/website`, {
        method: "PATCH",
        body: JSON.stringify({ website }),
      }),
    );
  }

  async refreshCandidateAudit(id: string, force?: boolean): Promise<SdrCandidate> {
    return toCandidate(
      await apiRequest<CandidateDto>(`/api/v1/sdr/candidates/${id}/audit/refresh`, {
        method: "POST",
        body: JSON.stringify({ force: force ?? false }),
      }),
    );
  }

  async listCandidateAudits(id: string): Promise<SdrCandidateAudit[]> {
    const dto = await apiRequest<AuditDto[]>(`/api/v1/sdr/candidates/${id}/audit`);
    return dto.map(toAudit);
  }

  // Etapa 5 — Score GSM determinístico (sem IA/LLM).

  async computeCandidateScore(id: string, ruleSet?: string): Promise<SdrCandidateScore> {
    return toScore(
      await apiRequest<ScoreDto>(`/api/v1/sdr/candidates/${id}/score/compute`, {
        method: "POST",
        body: JSON.stringify(ruleSet ? { rule_set: ruleSet } : {}),
      }),
    );
  }

  async listCandidateScores(id: string): Promise<SdrCandidateScore[]> {
    const dto = await apiRequest<ScoreDto[]>(`/api/v1/sdr/candidates/${id}/score`);
    return dto.map(toScore);
  }

  async computeCampaignScores(campaignId: string): Promise<{ enqueued: boolean }> {
    return await apiRequest<{ enqueued: boolean }>(
      `/api/v1/sdr/campaigns/${campaignId}/score/compute`,
      { method: "POST" },
    );
  }

  // Etapa 6 — IA Comercial.

  async generateCandidateOutreach(
    id: string,
    channel: SdrOutreachChannel,
    tone?: SdrOutreachTone,
  ): Promise<{ enqueued: boolean }> {
    return await apiRequest<{ enqueued: boolean }>(
      `/api/v1/sdr/candidates/${id}/outreach/generate`,
      { method: "POST", body: JSON.stringify({ channel, tone: tone ?? "standard" }) },
    );
  }

  async listCandidateOutreachGenerations(id: string): Promise<SdrCandidateOutreachGeneration[]> {
    const dto = await apiRequest<OutreachGenerationDto[]>(`/api/v1/sdr/candidates/${id}/outreach`);
    return dto.map(toOutreachGeneration);
  }

  // Etapa 7 — operação comercial ("Prospectar hoje").

  async listProspectingQueue(
    filter?: SdrProspectingQueueFilter,
  ): Promise<SdrProspectSdrContext[]> {
    const params = new URLSearchParams();
    if (filter?.niche) params.set("niche", filter.niche);
    if (filter?.minPriority) params.set("min_priority", filter.minPriority);
    const query = params.toString();
    const dto = await apiRequest<ProspectSdrContextDto[]>(
      `/api/v1/sdr/prospecting-queue${query ? `?${query}` : ""}`,
    );
    return dto.map(toProspectSdrContext);
  }

  async getProspectOutreachContext(prospectId: string): Promise<SdrProspectSdrContext> {
    return toProspectSdrContext(
      await apiRequest<ProspectSdrContextDto>(
        `/api/v1/sdr/prospects/${prospectId}/outreach-context`,
      ),
    );
  }

  // Etapa 8 — dashboard, funil real e custos.

  async getDashboardOverview(): Promise<SdrDashboardOverview> {
    const dto = await apiRequest<DashboardOverviewDto>("/api/v1/sdr/dashboard/overview");
    return toDashboardOverview(dto);
  }

  async getDashboardCosts(): Promise<SdrProviderCostSummary[]> {
    const dto = await apiRequest<ProviderCostSummaryDto[]>("/api/v1/sdr/dashboard/costs");
    return dto.map(toProviderCostSummary);
  }
}
