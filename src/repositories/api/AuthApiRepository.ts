import type { AuthRepository } from "../AuthRepository";
import type { AuthUser, LoginInput, Session } from "../../types/auth";
import type { User } from "../../types/user";
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
}

function toSession(dto: TokenResponseDto, user: AuthUser): Session {
  return {
    user,
    tokens: { accessToken: dto.access_token, refreshToken: dto.refresh_token },
  };
}

function toAuthUser(dto: UserResponseDto): AuthUser {
  return { id: dto.id, tenantId: dto.tenant_id, email: dto.email, name: dto.name, role: dto.role };
}

function toUser(dto: UserResponseDto): User {
  const role = dto.role === "admin" ? "admin" : "vendedor";
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    name: dto.name,
    email: dto.email,
    team: "—",
    role,
    bg: "rgba(74,163,255,.14)",
    color: "#4aa3ff",
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

  async me(_accessToken: string): Promise<AuthUser> {
    const dto = await apiRequest<UserResponseDto>("/api/v1/auth/me");
    return toAuthUser(dto);
  }

  async listUsers(): Promise<User[]> {
    const dtos = await apiRequest<UserResponseDto[]>("/api/v1/users");
    return dtos.map(toUser);
  }

  async createUser(input: Pick<User, "name" | "email" | "role" | "team">): Promise<User> {
    const dto = await apiRequest<UserResponseDto>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        role: input.role,
        password: crypto.randomUUID(),
      }),
    });
    return toUser(dto);
  }
}
