import { platformService } from "../services/PlatformService";
import type { Page } from "../types/common";
import type {
  AuditFilter,
  FeatureDefinition,
  ImpersonationSession,
  OrganizationDetail,
  OrganizationFilter,
  OrganizationSummary,
  PlanOption,
  PlatformAuditLog,
  PlatformOverview,
} from "../types/platform";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Leituras do control plane (Etapa 2). Mutações chamam `platformService`
 * direto nas páginas da plataforma (área só de staff). */
export function usePlatformOverview(): AsyncResourceState<PlatformOverview> {
  return useAsyncResource(() => platformService.overview(), []);
}

export function useOrganizations(
  filter: OrganizationFilter,
): AsyncResourceState<Page<OrganizationSummary>> {
  return useAsyncResource(() => platformService.listOrganizations(filter), [JSON.stringify(filter)]);
}

export function useOrganization(id: string | undefined): AsyncResourceState<OrganizationDetail | null> {
  return useAsyncResource(async () => (id ? platformService.getOrganization(id) : null), [id]);
}

export function usePlatformCatalog(): AsyncResourceState<{
  features: FeatureDefinition[];
  plans: PlanOption[];
}> {
  return useAsyncResource(async () => {
    const [features, plans] = await Promise.all([
      platformService.features(),
      platformService.plans(),
    ]);
    return { features, plans };
  }, []);
}

export function usePlatformAudit(filter: AuditFilter): AsyncResourceState<Page<PlatformAuditLog>> {
  return useAsyncResource(() => platformService.auditLogs(filter), [JSON.stringify(filter)]);
}

export function useSupportSessions(
  openOnly: boolean,
  page: number,
): AsyncResourceState<Page<ImpersonationSession>> {
  return useAsyncResource(() => platformService.sessions(openOnly, page), [openOnly, page]);
}
