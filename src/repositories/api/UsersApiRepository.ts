import type { UsersRepository } from "../UsersRepository";
import type { CreateUserInput, User } from "../../types/user";
import { apiRequest } from "./ApiClient";

interface UserResponseDto {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: string;
  must_change_password: boolean;
}

function toRole(role: string): User["role"] {
  return role === "admin" || role === "gestor" || role === "vendedor" ? role : "vendedor";
}

function toUser(dto: UserResponseDto): User {
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
    const dtos = await apiRequest<UserResponseDto[]>("/api/v1/users");
    return dtos.map(toUser);
  }

  async create(input: CreateUserInput): Promise<User> {
    const dto = await apiRequest<UserResponseDto>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        role: input.role,
        password: input.password,
      }),
    });
    return toUser(dto);
  }
}
