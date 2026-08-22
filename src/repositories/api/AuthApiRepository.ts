import type { AuthRepository } from "../AuthRepository";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  Session,
} from "../../types/auth";
import { apiRequest } from "./ApiClient";

interface TokenResponseDto {
  access_token: string;
  refresh_token: string;
}

interface UserResponseDto {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: string;
  must_change_password: boolean;
  is_super_admin: boolean;
}

function toSession(dto: TokenResponseDto, user: AuthUser): Session {
  return {
    user,
    tokens: { accessToken: dto.access_token, refreshToken: dto.refresh_token },
  };
}

function toAuthUser(dto: UserResponseDto): AuthUser {
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    email: dto.email,
    name: dto.name,
    role: dto.role,
    mustChangePassword: dto.must_change_password,
    isSuperAdmin: dto.is_super_admin,
  };
}

export class AuthApiRepository implements AuthRepository {
  async login(input: LoginInput): Promise<Session> {
    const tokens = await apiRequest<TokenResponseDto>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: input.email, password: input.password }),
    });
    const user = await this.me(tokens.access_token);
    return toSession(tokens, user);
  }

  async refresh(refreshToken: string): Promise<Session> {
    const tokens = await apiRequest<TokenResponseDto>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const user = await this.me(tokens.access_token);
    return toSession(tokens, user);
  }

  async logout(refreshToken: string): Promise<void> {
    await apiRequest<void>("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async me(accessToken: string): Promise<AuthUser> {
    const dto = await apiRequest<UserResponseDto>("/api/v1/auth/me", {}, accessToken);
    return toAuthUser(dto);
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    await apiRequest<{ detail: string }>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: input.email }),
    });
  }

  async confirmPasswordReset(input: ResetPasswordInput): Promise<void> {
    await apiRequest<{ detail: string }>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: input.token, new_password: input.newPassword }),
    });
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiRequest<{ detail: string }>("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: input.currentPassword,
        new_password: input.newPassword,
      }),
    });
  }
}
