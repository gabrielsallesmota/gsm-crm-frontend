import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  Session,
} from "../types/auth";

export interface AuthRepository {
  login(input: LoginInput): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  me(accessToken: string): Promise<AuthUser>;
  requestPasswordReset(input: RequestPasswordResetInput): Promise<void>;
  confirmPasswordReset(input: ResetPasswordInput): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
}
