import { usersService } from "../services/UsersService";
import type { CreateUserInput, CreateUserResult, UpdateMemberInput, User } from "../types/user";

export interface UserActions {
  create(input: CreateUserInput): Promise<CreateUserResult>;
  update(userId: string, input: UpdateMemberInput): Promise<User>;
  resendInvitation(userId: string): Promise<boolean>;
}

export function useUserActions(): UserActions {
  return {
    create: (input) => usersService.create(input),
    update: (userId, input) => usersService.update(userId, input),
    resendInvitation: (userId) => usersService.resendInvitation(userId),
  };
}
