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
 * - pipeline.reorder  → PATCH /stages/reorder (ADMIN, GESTOR)
 * - platform.internal → SDR, Prospecção GSM, Clientes GSM, /platform (platform_staff)
 */
export type Permission =
  | "users.view"
  | "users.create"
  | "settings.manage"
  | "pipeline.reorder"
  | "platform.internal";

export type TenantRole = "admin" | "gestor" | "vendedor";

const TENANT_ROLES: readonly TenantRole[] = ["admin", "gestor", "vendedor"];

const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
  admin: ["users.view", "users.create", "settings.manage", "pipeline.reorder"],
  gestor: ["users.view", "settings.manage", "pipeline.reorder"],
  vendedor: [],
};

export function toTenantRole(role: string | undefined | null): TenantRole | null {
  return TENANT_ROLES.find((r) => r === role) ?? null;
}

type Principal = Pick<AuthUser, "role" | "isPlatformStaff"> | null | undefined;

export function can(user: Principal, permission: Permission): boolean {
  if (!user) return false;
  if (permission === "platform.internal") return user.isPlatformStaff === true;
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
  return permission === "platform.internal" ? "not_found" : "forbidden";
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
