import type { UsersRepository } from "../UsersRepository";
import type {
  CreateUserInput,
  CreateUserResult,
  DirectoryMember,
  MemberStatus,
  UpdateMemberInput,
  User,
  UserRole,
} from "../../types/user";
import { apiRequest } from "./ApiClient";

/** `GET /api/v1/users` e `PATCH /api/v1/users/{id}`. */
interface TenantMemberDto {
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  pending_first_access: boolean;
}

/** `POST /api/v1/users` — `UserResponse` + `invitation_sent`. */
interface CreatedUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string;
  must_change_password: boolean;
  invitation_sent: boolean | null;
}

interface DirectoryMemberDto {
  user_id: string;
  name: string;
  role: string;
}

function toRole(role: string): UserRole {
  return role === "admin" || role === "gestor" || role === "vendedor" ? role : "vendedor";
}

function toStatus(status: string): MemberStatus {
  return status === "active" || status === "suspended" || status === "invited"
    ? status
    : "suspended";
}

const AVATAR = { bg: "rgba(74,163,255,.14)", color: "#4aa3ff" };

function fromTenantMember(dto: TenantMemberDto): User {
  return {
    id: dto.user_id,
    name: dto.name,
    email: dto.email,
    role: toRole(dto.role),
    status: toStatus(dto.status),
    pendingFirstAccess: dto.pending_first_access,
    ...AVATAR,
  };
}

export class UsersApiRepository implements UsersRepository {
  async list(): Promise<User[]> {
    const dtos = await apiRequest<TenantMemberDto[]>("/api/v1/users");
    return dtos.map(fromTenantMember);
  }

  async directory(): Promise<DirectoryMember[]> {
    const dtos = await apiRequest<DirectoryMemberDto[]>("/api/v1/users/directory");
    return dtos.map((d) => ({ id: d.user_id, name: d.name, role: toRole(d.role) }));
  }

  async create(input: CreateUserInput): Promise<CreateUserResult> {
    const dto = await apiRequest<CreatedUserDto>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        role: input.role,
        // Sem senha = convite por e-mail (o backend gera o link de primeiro acesso).
        password: input.password || undefined,
      }),
    });
    return {
      user: {
        id: dto.id,
        tenantId: dto.tenant_id,
        name: dto.name,
        email: dto.email,
        role: toRole(dto.role),
        status: "active",
        pendingFirstAccess: dto.must_change_password,
        ...AVATAR,
      },
      invitationSent: dto.invitation_sent,
    };
  }

  async update(userId: string, input: UpdateMemberInput): Promise<User> {
    const dto = await apiRequest<TenantMemberDto>(`/api/v1/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role: input.role, active: input.active }),
    });
    return fromTenantMember(dto);
  }

  async resendInvitation(userId: string): Promise<boolean> {
    const dto = await apiRequest<{ invitation_sent: boolean }>(
      `/api/v1/users/${userId}/resend-invitation`,
      { method: "POST" },
    );
    return dto.invitation_sent;
  }
}
