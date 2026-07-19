import type { AuthRepository } from "../repositories/AuthRepository";
import { AuthApiRepository } from "../repositories/api/AuthApiRepository";
import { AuthMockRepository } from "../repositories/mock/AuthMockRepository";
import { CRM_MODE } from "./factory";
import type { User } from "../types/user";

const repo: AuthRepository = CRM_MODE === "demo" ? new AuthMockRepository() : new AuthApiRepository();

export class UsersService {
  list(): Promise<User[]> {
    return repo.listUsers();
  }

  create(input: Pick<User, "name" | "email" | "role" | "team">): Promise<User> {
    return repo.createUser(input);
  }
}

export const usersService = new UsersService();
