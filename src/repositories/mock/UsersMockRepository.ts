import type { UsersRepository } from "../UsersRepository";
import type { CreateUserInput, User } from "../../types/user";
import { delay } from "../../utils/errors";
import { mockState, nextUserId } from "./state";

export class UsersMockRepository implements UsersRepository {
  async list(): Promise<User[]> {
    await delay(200);
    return mockState.users.filter((u) => u.tenantId === mockState.currentTenantId);
  }

  async create(input: CreateUserInput): Promise<User> {
    await delay(200);
    const user: User = {
      id: nextUserId(),
      tenantId: mockState.currentTenantId,
      name: input.name,
      email: input.email,
      team: input.team,
      role: input.role,
      bg: "rgba(74,163,255,.14)",
      color: "#4aa3ff",
    };
    mockState.users.push(user);
    return user;
  }
}
