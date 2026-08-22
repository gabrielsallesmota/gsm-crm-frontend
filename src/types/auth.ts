export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
  /** Flag de plataforma, ortogonal a `role` — libera o painel "Prospecção
   * GSM" (funil comercial interno da GSM, não do tenant). Ver
   * `app.core.deps.require_super_admin` no backend. */
  isSuperAdmin: boolean;
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
