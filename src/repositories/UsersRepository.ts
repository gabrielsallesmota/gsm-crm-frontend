import type { CreateUserInput, User } from "../types/user";

export interface UsersRepository {
  list(): Promise<User[]>;
  create(input: CreateUserInput): Promise<User>;
}
