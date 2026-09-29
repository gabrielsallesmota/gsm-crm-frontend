import type { AuthUser } from "../types/auth";

/**
 * Camada ÚNICA de autorização da UI — espelha os papéis reais do backend
 * (`Role` = admin | gestor | vendedor por tenant, e `platform_staff` como
 * escopo de plataforma independente). Nenhuma tela deve comparar
 * `user.role === "..."` direto: pergunte `can(user, permission)`.
 *
 * IMPORTANTE: isto NÃO é fronteira de segurança. Só evita mostrar o que o
 * backend vai recusar e fecha rotas que não fazem sentido para o papel. A
 * autorização real continua 100% no backend (RLS, `require_tenant_role`,
 * `require_platform_staff`, `require_sdr_admin`).
 *
 * Fonte de cada regra (backend):
 * - users.view        → GET  /users           require_tenant_role(ADMIN, GESTOR)
 * - users.create      → POST /users           require_tenant_role(ADMIN)
 * - settings.manage   → escrita de pipelines/estágios/tags/templates (ADMIN, GESTOR)
 * - integrations.manage → /integrations/* credenciais de API e webhooks (ADMIN)
 * - pipeline.reorder  → PATCH /stages/reorder (ADMIN, GESTOR)
 * - leads.assign      → PATCH /leads/{id} owner_id (ADMIN, GESTOR; vendedor → 403)
 * - leads.viewAll     → vendedor só enxerga os próprios leads (escopo no backend)
 * - platform.internal → SDR, Prospecção GSM, Clientes GSM (platform_staff)
 * - platform.console  → control plane `/platform/*` (platform_staff)
 *
 * Etapa 2: durante uma SESSÃO DE SUPORTE (impersonation) a pessoa vê o
 * tenant do cliente como o admin dele vê — `platform.*` fica indisponível
 * (o backend também recusa o token de suporte nessas rotas) e as
 * permissões de gestão de usuários somem (o backend bloqueia).
 */
export type Permission =
  | "users.view"
  | "users.create"
  | "settings.manage"
  | "integrations.manage"
  | "pipeline.reorder"
  | "leads.assign"
  | "leads.viewAll"
  | "platform.internal"
  | "platform.console";

export type TenantRole = "admin" | "gestor" | "vendedor";

const TENANT_ROLES: readonly TenantRole[] = ["admin", "gestor", "vendedor"];

const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
  admin: [
    "users.view",
    "users.create",
    "settings.manage",
    "integrations.manage",
    "pipeline.reorder",
    "leads.assign",
    "leads.viewAll",
  ],
  gestor: ["users.view", "settings.manage", "pipeline.reorder", "leads.assign", "leads.viewAll"],
  vendedor: [],
};

export function toTenantRole(role: string | undefined | null): TenantRole | null {
  return TENANT_ROLES.find((r) => r === role) ?? null;
}

type Principal =
  | (Pick<AuthUser, "role" | "isPlatformStaff"> & Partial<Pick<AuthUser, "impersonation">>)
  | null
  | undefined;

// O suporte da GSM nunca gerencia usuários/papéis do cliente (bloqueado no
// backend mesmo com escrita liberada).
const BLOCKED_DURING_SUPPORT: readonly Permission[] = ["users.create"];

export function can(user: Principal, permission: Permission): boolean {
  if (!user) return false;
  const supporting = Boolean(user.impersonation);
  if (permission === "platform.internal" || permission === "platform.console") {
    return user.isPlatformStaff === true && !supporting;
  }
  if (supporting && BLOCKED_DURING_SUPPORT.includes(permission)) return false;
  const role = toTenantRole(user.role);
  // Papel desconhecido (ex.: backend novo, dado corrompido no storage) =
  // nenhuma permissão — nunca "admin por padrão".
  return role !== null && ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * O que a UI faz quando alguém abre uma rota sem a permissão exigida:
 * - `not_found`: rota INTERNA da GSM (SDR, Clientes) — para quem não é
 *   staff, a rota simplesmente "não existe" (não revela nem que há uma
 *   área interna, nem a estrutura dela).
 * - `forbidden`: rota do produto que existe para o tenant, mas não para
 *   este papel (ex.: vendedor em Usuários) — mensagem de acesso restrito.
 */
export type RouteAccess = "allow" | "not_found" | "forbidden";

export function evaluateRouteAccess(user: Principal, permission: Permission): RouteAccess {
  if (can(user, permission)) return "allow";
  return permission === "platform.internal" || permission === "platform.console"
    ? "not_found"
    : "forbidden";
}

export const ROLE_LABEL: Record<TenantRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  vendedor: "Vendedor",
};

export function roleLabel(role: string | undefined | null): string {
  const known = toTenantRole(role);
  return known ? ROLE_LABEL[known] : "";
}
