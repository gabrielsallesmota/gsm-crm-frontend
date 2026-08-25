import type { AuthRepository } from "../AuthRepository";
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
} from "../../types/auth";
import { apiRequest } from "./ApiClient";

interface TenantOptionDto {
  tenant_id: string;
  tenant_name: string;
  account_id: string;
  role: string;
}

interface LoginResponseDto {
  requires_tenant_selection: boolean;
  access_token?: string | null;
  refresh_token?: string | null;
  selection_token?: string | null;
  available_tenants?: TenantOptionDto[] | null;
}

interface TokenResponseDto {
  access_token: string;
  refresh_token: string;
}

interface UserResponseDto {
  id: string;
  email: string;
  name: string;
  must_change_password: boolean;
  account_id: string;
  tenant_id: string;
  role: string;
  is_platform_staff: boolean;
}

function toTenantOption(dto: TenantOptionDto): TenantOption {
  return { tenantId: dto.tenant_id, tenantName: dto.tenant_name, accountId: dto.account_id, role: dto.role };
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
    email: dto.email,
    name: dto.name,
    role: dto.role,
    mustChangePassword: dto.must_change_password,
    accountId: dto.account_id,
    tenantId: dto.tenant_id,
    isPlatformStaff: dto.is_platform_staff,
  };
}

export class AuthApiRepository implements AuthRepository {
  async login(input: LoginInput): Promise<LoginOutcome> {
    const dto = await apiRequest<LoginResponseDto>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: input.email, password: input.password }),
    });

    if (dto.requires_tenant_selection) {
      return {
        requiresTenantSelection: true,
        selectionToken: dto.selection_token ?? "",
        availableTenants: (dto.available_tenants ?? []).map(toTenantOption),
      };
    }

    // Backend garante access_token/refresh_token presentes quando
    // requires_tenant_selection é false (ver LoginResponse no backend) —
    // ainda assim tratamos ausência como erro em vez de mandar "Bearer
    // undefined" pra frente.
    if (!dto.access_token || !dto.refresh_token) {
      throw new Error("Resposta de login inesperada do servidor.");
    }
    const tokens: TokenResponseDto = { access_token: dto.access_token, refresh_token: dto.refresh_token };
    const user = await this.me(tokens.access_token);
    return { requiresTenantSelection: false, session: toSession(tokens, user) };
  }

  async selectTenant(input: SelectTenantInput): Promise<Session> {
    const tokens = await apiRequest<TokenResponseDto>("/api/v1/auth/select-tenant", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: input.tenantId,
        selection_token: input.selectionToken,
        refresh_token: input.refreshToken,
      }),
    });
    const user = await this.me(tokens.access_token);
    return toSession(tokens, user);
  }

  async listTenants(accessToken: string): Promise<TenantOption[]> {
    const dtos = await apiRequest<TenantOptionDto[]>("/api/v1/auth/tenants", {}, accessToken);
    return dtos.map(toTenantOption);
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
