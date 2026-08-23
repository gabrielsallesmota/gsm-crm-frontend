export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Papel operacional NO TENANT ATUAL (`TenantMembership.role`) — não é
   * mais um atributo fixo e global da pessoa (Fase 1-3 do backend: uma
   * pessoa pode ter roles diferentes em tenants diferentes). */
  role: string;
  mustChangePassword: boolean;
  /** Dono comercial do tenant atual (`tenant.account_id`) — nunca usado
   * para autorizar acesso a dado operacional de outro tenant, só para uso
   * administrativo futuro (Agency Portal). */
  accountId: string;
  /** Tenant selecionado NESTA sessão — pode não ser o único que a pessoa
   * acessa (ver `availableTenants` em AuthContext). Trocar de tenant sempre
   * gera um novo token via `POST /auth/select-tenant`, nunca é só estado
   * local (ver ADR "JWT Tenant Selection"). */
  tenantId: string;
  // Nota: `isSuperAdmin` não existe mais — o backend nunca mais expõe acesso
  // de plataforma neste objeto (nem no JWT, nem em /auth/me). O mecanismo
  // real é `platform_staff`, sem superfície HTTP ainda (Fase 10).
}

/** Um tenant que a pessoa pode acessar — devolvido no login (quando há mais
 * de um) e por `GET /auth/tenants`. */
export interface TenantOption {
  tenantId: string;
  tenantName: string;
  accountId: string;
  role: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface Session {
  user: AuthUser;
  tokens: TokenResponse;
}

/** Duas formas mutuamente exclusivas, espelhando `LoginResponse` do backend
 * (ver ADR "JWT Tenant Selection"): ou a pessoa tinha 1 tenant ativo e já
 * está autenticada (`session`), ou precisa escolher entre vários
 * (`selectionToken` + `availableTenants`) antes de qualquer token
 * operacional existir. */
export type LoginOutcome =
  | { requiresTenantSelection: false; session: Session }
  | { requiresTenantSelection: true; selectionToken: string; availableTenants: TenantOption[] };

/** Exatamente um entre `selectionToken` (logo após o login) e
 * `refreshToken` (trocando de tenant numa sessão já ativa) deve ser
 * enviado — nunca os dois, nunca nenhum (o backend valida isso também,
 * este contrato só espelha o dele). */
export interface SelectTenantInput {
  tenantId: string;
  selectionToken?: string | undefined;
  refreshToken?: string | undefined;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
