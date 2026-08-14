import { usersService } from "../services/UsersService";
import type { CreateUserInput, User } from "../types/user";

export interface UserActions {
  create(input: CreateUserInput): Promise<User>;
}

export function useUserActions(): UserActions {
  return {
    create: (input) => usersService.create(input),
  };
}
