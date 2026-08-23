import type { AuthRepository } from "../repositories/AuthRepository";
import { AuthApiRepository } from "../repositories/api/AuthApiRepository";
import { AuthMockRepository } from "../repositories/mock/AuthMockRepository";
import { selectRepository } from "./factory";
import type {
  ChangePasswordInput,
  LoginInput,
  LoginOutcome,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SelectTenantInput,
  Session,
  TenantOption,
} from "../types/auth";

const repo: AuthRepository = selectRepository(
  () => new AuthMockRepository(),
  () => new AuthApiRepository(),
);

export class AuthService {
  login(input: LoginInput): Promise<LoginOutcome> {
    return repo.login(input);
  }

  selectTenant(input: SelectTenantInput): Promise<Session> {
    return repo.selectTenant(input);
  }

  listTenants(accessToken: string): Promise<TenantOption[]> {
    return repo.listTenants(accessToken);
  }

  refresh(refreshToken: string): Promise<Session> {
    return repo.refresh(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return repo.logout(refreshToken);
  }

  requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    return repo.requestPasswordReset(input);
  }

  confirmPasswordReset(input: ResetPasswordInput): Promise<void> {
    return repo.confirmPasswordReset(input);
  }

  changePassword(input: ChangePasswordInput): Promise<void> {
    return repo.changePassword(input);
  }
}

export const authService = new AuthService();
