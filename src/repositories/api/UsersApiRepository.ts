import type { UsersRepository } from "../UsersRepository";
import type { CreateUserInput, User } from "../../types/user";
import { apiRequest } from "./ApiClient";

/** `GET /api/v1/users` (Fase 3) — forma NOVA e DIFERENTE da resposta de
 * criação: cada membro vem de `TenantMemberResponse` (JOIN
 * tenant_memberships+users), sem `tenant_id` (todo membro listado já é do
 * tenant atual) e com `user_id` em vez de `id`. */
interface TenantMemberDto {
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

/** `POST /api/v1/users` — resposta é `UserResponse` (mesma forma de
 * `/auth/me`), com `id`/`tenant_id`. */
interface CreatedUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string;
}

function toRole(role: string): User["role"] {
  return role === "admin" || role === "gestor" || role === "vendedor" ? role : "vendedor";
}

function fromTenantMember(dto: TenantMemberDto): User {
  return {
    id: dto.user_id,
    name: dto.name,
    email: dto.email,
    team: "—",
    role: toRole(dto.role),
    bg: "rgba(74,163,255,.14)",
    color: "#4aa3ff",
  };
}

function fromCreatedUser(dto: CreatedUserDto): User {
  return {
    id: dto.id,
    tenantId: dto.tenant_id,
    name: dto.name,
    email: dto.email,
    team: "—",
    role: toRole(dto.role),
    bg: "rgba(74,163,255,.14)",
    color: "#4aa3ff",
  };
}

export class UsersApiRepository implements UsersRepository {
  async list(): Promise<User[]> {
    const dtos = await apiRequest<TenantMemberDto[]>("/api/v1/users");
    return dtos.map(fromTenantMember);
  }

  async create(input: CreateUserInput): Promise<User> {
    const dto = await apiRequest<CreatedUserDto>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        role: input.role,
        password: input.password,
      }),
    });
    return fromCreatedUser(dto);
  }
}
