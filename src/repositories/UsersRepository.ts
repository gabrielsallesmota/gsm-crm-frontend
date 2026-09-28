import type {
  CreateUserInput,
  CreateUserResult,
  DirectoryMember,
  UpdateMemberInput,
  User,
} from "../types/user";

export interface UsersRepository {
  list(): Promise<User[]>;
  directory(): Promise<DirectoryMember[]>;
  create(input: CreateUserInput): Promise<CreateUserResult>;
  update(userId: string, input: UpdateMemberInput): Promise<User>;
  resendInvitation(userId: string): Promise<boolean>;
}
