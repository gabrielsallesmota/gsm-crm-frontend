import type { AuthRepository } from "../repositories/AuthRepository";
import { AuthApiRepository } from "../repositories/api/AuthApiRepository";
import { AuthMockRepository } from "../repositories/mock/AuthMockRepository";
import { CRM_MODE } from "./factory";
import type {
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  Session,
} from "../types/auth";

const repo: AuthRepository = CRM_MODE === "demo" ? new AuthMockRepository() : new AuthApiRepository();

export class AuthService {
  login(input: LoginInput): Promise<Session> {
    return repo.login(input);
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
