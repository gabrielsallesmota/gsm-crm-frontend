import type { UsersRepository } from "../repositories/UsersRepository";
import { UsersApiRepository } from "../repositories/api/UsersApiRepository";
import { UsersMockRepository } from "../repositories/mock/UsersMockRepository";
import { selectRepository } from "./factory";
import type { CreateUserInput, User } from "../types/user";

const repo: UsersRepository = selectRepository(
  () => new UsersMockRepository(),
  () => new UsersApiRepository(),
);

export class UsersService {
  list(): Promise<User[]> {
    return repo.list();
  }

  create(input: CreateUserInput): Promise<User> {
    return repo.create(input);
  }
}

export const usersService = new UsersService();
