import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  LoginOutcome,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SelectTenantInput,
  Session,
  TenantOption,
} from "../types/auth";

export interface AuthRepository {
  login(input: LoginInput): Promise<LoginOutcome>;
  /** Único caminho para trocar o tenant ativo — nunca uma troca de estado
   * local (ver ADR "JWT Tenant Selection"). Cobre tanto a seleção logo após
   * o login (`selectionToken`) quanto a troca numa sessão já ativa
   * (`refreshToken`). */
  selectTenant(input: SelectTenantInput): Promise<Session>;
  /** Alimenta o seletor de tenant já logado (troca de tenant, não só no
   * login) — `GET /auth/tenants`. */
  listTenants(accessToken: string): Promise<TenantOption[]>;
  refresh(refreshToken: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  me(accessToken: string): Promise<AuthUser>;
  requestPasswordReset(input: RequestPasswordResetInput): Promise<void>;
  confirmPasswordReset(input: ResetPasswordInput): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
}
