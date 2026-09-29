/** Control plane da GSM (Etapa 2) — `/api/v1/platform/*`. */

export type OrganizationStatus = "active" | "suspended";

export interface PlatformOverview {
  organizationsActive: number;
  organizationsSuspended: number;
  tenantsTotal: number;
  openImpersonations: number;
  platformInternalConfigured: boolean;
}

export interface FeatureDefinition {
  code: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** `false` = reservada (ainda sem endpoint) — não pode ser contratada. */
  available: boolean;
}

export interface PlanOption {
  code: string;
  name: string;
  priceCents: number;
  maxTenants: number | null;
  maxApiKeys: number | null;
  features: string[];
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: OrganizationStatus | string;
  planCode: string | null;
  planName: string | null;
  tenantsCount: number;
  activeUsers: number;
  isPlatformInternal: boolean;
  createdAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
}

export interface TenantAdmin {
  userId: string;
  name: string;
  email: string;
  pendingFirstAccess: boolean;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus | string;
  isPlatformInternal: boolean;
  activeUsers: number;
  createdAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
  features: Record<string, boolean>;
  admins: TenantAdmin[];
}

export interface OrganizationDetail {
  organization: OrganizationSummary;
  tenants: TenantDetail[];
}

export interface OrganizationFilter {
  search?: string;
  status?: OrganizationStatus | "";
  page?: number;
  pageSize?: number;
}

export interface ProvisionOrganizationInput {
  name: string;
  slug: string;
  planCode: string;
  adminName: string;
  adminEmail: string;
  features: Record<string, boolean>;
}

export interface ProvisionOrganizationResult {
  accountId: string;
  tenantId: string;
  admin: { id: string; name: string; email: string; existingUser: boolean };
  /** `true` enviado; `false` falhou (reenviar); `null` admin já existia. */
  invitationSent: boolean | null;
}

export interface UpdateOrganizationInput {
  name?: string;
  planCode?: string;
}

export interface ImpersonationSession {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorEmail: string | null;
  targetTenantId: string;
  tenantName: string | null;
  reason: string;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedByUserId: string | null;
  ip: string | null;
  mode: string;
  elevatedAt: string | null;
  elevationReason: string | null;
  isOpen: boolean;
}

export interface StartImpersonationResult {
  accessToken: string;
  expiresAt: string;
  sessionId: string;
  mode: string;
  tenantName: string;
}

export interface PlatformAuditLog {
  id: string;
  actorType: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  accountId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  impersonationSessionId: string | null;
  createdAt: string;
}

export interface AuditFilter {
  action?: string;
  accountId?: string;
  tenantId?: string;
  onlyImpersonation?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
