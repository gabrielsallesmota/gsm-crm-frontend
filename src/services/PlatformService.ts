import { platformRequest } from "../repositories/api/ApiClient";
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
  ProvisionOrganizationInput,
  ProvisionOrganizationResult,
  StartImpersonationResult,
  TenantDetail,
  UpdateOrganizationInput,
} from "../types/platform";

/**
 * Control plane da GSM — só API real (não existe na demonstração). Todas as
 * chamadas saem pela sessão REAL do staff (`platformRequest`), inclusive
 * durante uma sessão de suporte. Autorização: o backend (`platform_staff`).
 */

type Dto = Record<string, unknown>;
const P = "/api/v1/platform";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function toOrganization(d: Dto): OrganizationSummary {
  return {
    id: str(d.id),
    name: str(d.name),
    slug: str(d.slug),
    type: str(d.type),
    status: str(d.status),
    planCode: strOrNull(d.plan_code),
    planName: strOrNull(d.plan_name),
    tenantsCount: num(d.tenants_count),
    activeUsers: num(d.active_users),
    isPlatformInternal: d.is_platform_internal === true,
    createdAt: str(d.created_at),
    suspendedAt: strOrNull(d.suspended_at),
    suspensionReason: strOrNull(d.suspension_reason),
  };
}

function toTenant(d: Dto): TenantDetail {
  const admins = Array.isArray(d.admins) ? (d.admins as Dto[]) : [];
  return {
    id: str(d.id),
    name: str(d.name),
    slug: str(d.slug),
    status: str(d.status),
    isPlatformInternal: d.is_platform_internal === true,
    activeUsers: num(d.active_users),
    createdAt: str(d.created_at),
    suspendedAt: strOrNull(d.suspended_at),
    suspensionReason: strOrNull(d.suspension_reason),
    features: (d.features ?? {}) as Record<string, boolean>,
    admins: admins.map((a) => ({
      userId: str(a.user_id),
      name: str(a.name),
      email: str(a.email),
      pendingFirstAccess: a.pending_first_access === true,
    })),
  };
}

function toSession(d: Dto): ImpersonationSession {
  return {
    id: str(d.id),
    actorUserId: str(d.actor_user_id),
    actorName: strOrNull(d.actor_name),
    actorEmail: strOrNull(d.actor_email),
    targetTenantId: str(d.target_tenant_id),
    tenantName: strOrNull(d.tenant_name),
    reason: str(d.reason),
    startedAt: str(d.started_at),
    expiresAt: str(d.expires_at),
    endedAt: strOrNull(d.ended_at),
    endedByUserId: strOrNull(d.ended_by_user_id),
    ip: strOrNull(d.ip),
    mode: str(d.mode),
    elevatedAt: strOrNull(d.elevated_at),
    elevationReason: strOrNull(d.elevation_reason),
    isOpen: d.is_open === true,
  };
}

function toAudit(d: Dto): PlatformAuditLog {
  return {
    id: str(d.id),
    actorType: str(d.actor_type),
    actorUserId: strOrNull(d.actor_user_id),
    actorName: strOrNull(d.actor_name),
    actorEmail: strOrNull(d.actor_email),
    accountId: strOrNull(d.account_id),
    tenantId: strOrNull(d.tenant_id),
    tenantName: strOrNull(d.tenant_name),
    action: str(d.action),
    resourceType: strOrNull(d.resource_type),
    resourceId: strOrNull(d.resource_id),
    metadata: (d.metadata ?? null) as Record<string, unknown> | null,
    ip: strOrNull(d.ip),
    impersonationSessionId: strOrNull(d.impersonation_session_id),
    createdAt: str(d.created_at),
  };
}

function toPage<T>(dto: Dto, map: (d: Dto) => T): Page<T> {
  return {
    items: ((dto.items as Dto[] | undefined) ?? []).map(map),
    total: num(dto.total),
    page: num(dto.page),
    pageSize: num(dto.page_size),
  };
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const platformService = {
  async overview(): Promise<PlatformOverview> {
    const d = await platformRequest<Dto>(`${P}/overview`);
    return {
      organizationsActive: num(d.organizations_active),
      organizationsSuspended: num(d.organizations_suspended),
      tenantsTotal: num(d.tenants_total),
      openImpersonations: num(d.open_impersonations),
      platformInternalConfigured: d.platform_internal_configured === true,
    };
  },

  async features(): Promise<FeatureDefinition[]> {
    const list = await platformRequest<Dto[]>(`${P}/features`);
    return list.map((d) => ({
      code: str(d.code),
      label: str(d.label),
      description: str(d.description),
      defaultEnabled: d.default_enabled === true,
      available: d.available === true,
    }));
  },

  async plans(): Promise<PlanOption[]> {
    const list = await platformRequest<Dto[]>(`${P}/plans`);
    return list.map((d) => ({
      code: str(d.code),
      name: str(d.name),
      priceCents: num(d.price_cents),
      maxTenants: typeof d.max_tenants === "number" ? d.max_tenants : null,
      maxApiKeys: typeof d.max_api_keys === "number" ? d.max_api_keys : null,
      features: Array.isArray(d.features) ? (d.features as string[]) : [],
    }));
  },

  async listOrganizations(filter: OrganizationFilter): Promise<Page<OrganizationSummary>> {
    const d = await platformRequest<Dto>(
      `${P}/organizations${qs({
        search: filter.search?.trim(),
        status: filter.status,
        page: filter.page ?? 1,
        page_size: filter.pageSize ?? 20,
      })}`,
    );
    return toPage(d, toOrganization);
  },

  async getOrganization(id: string): Promise<OrganizationDetail> {
    const d = await platformRequest<Dto>(`${P}/organizations/${id}`);
    return {
      organization: toOrganization(d.organization as Dto),
      tenants: ((d.tenants as Dto[] | undefined) ?? []).map(toTenant),
    };
  },

  async provision(input: ProvisionOrganizationInput): Promise<ProvisionOrganizationResult> {
    const d = await platformRequest<Dto>(
      `${P}/organizations`,
      json("POST", {
        name: input.name,
        slug: input.slug,
        plan_code: input.planCode,
        admin_name: input.adminName,
        admin_email: input.adminEmail,
        features: input.features,
      }),
    );
    const admin = d.admin as Dto;
    return {
      accountId: str(d.account_id),
      tenantId: str(d.tenant_id),
      admin: {
        id: str(admin.id),
        name: str(admin.name),
        email: str(admin.email),
        existingUser: admin.existing_user === true,
      },
      invitationSent: typeof d.invitation_sent === "boolean" ? d.invitation_sent : null,
    };
  },

  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<void> {
    await platformRequest(
      `${P}/organizations/${id}`,
      json("PATCH", {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.planCode !== undefined ? { plan_code: input.planCode } : {}),
      }),
    );
  },

  async suspendOrganization(id: string, reason: string): Promise<void> {
    await platformRequest(`${P}/organizations/${id}/suspend`, json("POST", { reason }));
  },

  async reactivateOrganization(id: string): Promise<void> {
    await platformRequest(`${P}/organizations/${id}/reactivate`, json("POST"));
  },

  async suspendTenant(id: string, reason: string): Promise<void> {
    await platformRequest(`${P}/tenants/${id}/suspend`, json("POST", { reason }));
  },

  async reactivateTenant(id: string): Promise<void> {
    await platformRequest(`${P}/tenants/${id}/reactivate`, json("POST"));
  },

  async updateFeatures(tenantId: string, features: Record<string, boolean>): Promise<void> {
    await platformRequest(`${P}/tenants/${tenantId}/features`, json("PUT", { features }));
  },

  async resendAdminInvitation(tenantId: string, userId: string): Promise<boolean> {
    const d = await platformRequest<Dto>(
      `${P}/tenants/${tenantId}/members/${userId}/resend-invitation`,
      json("POST"),
    );
    return d.invitation_sent === true;
  },

  async auditLogs(filter: AuditFilter): Promise<Page<PlatformAuditLog>> {
    const d = await platformRequest<Dto>(
      `${P}/audit-logs${qs({
        action: filter.action,
        account_id: filter.accountId,
        tenant_id: filter.tenantId,
        only_impersonation: filter.onlyImpersonation,
        date_from: filter.dateFrom,
        date_to: filter.dateTo,
        page: filter.page ?? 1,
        page_size: filter.pageSize ?? 50,
      })}`,
    );
    return toPage(d, toAudit);
  },

  async sessions(openOnly: boolean, page = 1): Promise<Page<ImpersonationSession>> {
    const d = await platformRequest<Dto>(
      `${P}/impersonation-sessions${qs({ open_only: openOnly, page, page_size: 25 })}`,
    );
    return toPage(d, toSession);
  },

  async startImpersonation(
    tenantId: string,
    reason: string,
    durationMinutes: number,
  ): Promise<StartImpersonationResult> {
    const d = await platformRequest<Dto>(
      `${P}/tenants/${tenantId}/impersonate`,
      json("POST", { reason, duration_minutes: durationMinutes }),
    );
    return {
      accessToken: str(d.access_token),
      expiresAt: str(d.expires_at),
      sessionId: str(d.impersonation_session_id),
      mode: str(d.mode),
      tenantName: str(d.tenant_name),
    };
  },

  async elevateImpersonation(sessionId: string, reason: string): Promise<ImpersonationSession> {
    const d = await platformRequest<Dto>(
      `${P}/impersonation-sessions/${sessionId}/elevate`,
      json("POST", { reason }),
    );
    return toSession(d);
  },

  async endImpersonation(sessionId: string): Promise<void> {
    await platformRequest(`${P}/impersonation-sessions/${sessionId}/end`, json("POST"));
  },
};
