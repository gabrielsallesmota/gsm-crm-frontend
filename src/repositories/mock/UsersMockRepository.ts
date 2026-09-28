import type { UsersRepository } from "../UsersRepository";
import type {
  CreateUserInput,
  CreateUserResult,
  DirectoryMember,
  UpdateMemberInput,
  User,
} from "../../types/user";
import { delay } from "../../utils/errors";
import { mockState, nextUserId } from "./state";

export class UsersMockRepository implements UsersRepository {
  async list(): Promise<User[]> {
    await delay(200);
    return mockState.users.filter((u) => u.tenantId === mockState.currentTenantId);
  }

  async directory(): Promise<DirectoryMember[]> {
    const users = await this.list();
    return users
      .filter((u) => u.status === "active")
      .map((u) => ({ id: u.id, name: u.name, role: u.role }));
  }

  async create(input: CreateUserInput): Promise<CreateUserResult> {
    await delay(200);
    const user: User = {
      id: nextUserId(),
      tenantId: mockState.currentTenantId,
      name: input.name,
      email: input.email,
      role: input.role,
      status: "active",
      pendingFirstAccess: true,
      bg: "rgba(74,163,255,.14)",
      color: "#4aa3ff",
    };
    mockState.users.push(user);
    // A demonstração não envia e-mail de verdade.
    return { user, invitationSent: input.password ? null : false };
  }

  async update(userId: string, input: UpdateMemberInput): Promise<User> {
    await delay(150);
    const user = mockState.users.find((u) => u.id === userId);
    if (!user) throw new Error(`Usuário ${userId} não encontrado.`);
    if (input.role) user.role = input.role;
    if (input.active !== undefined) user.status = input.active ? "active" : "suspended";
    return user;
  }

  async resendInvitation(_userId: string): Promise<boolean> {
    await delay(150);
    return false;
  }
}
