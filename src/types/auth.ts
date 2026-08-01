export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
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
