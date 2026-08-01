import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  Session,
} from "../types/auth";
import type { CreateUserInput, User } from "../types/user";

export interface AuthRepository {
  login(input: LoginInput): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  me(accessToken: string): Promise<AuthUser>;
  listUsers(): Promise<User[]>;
  createUser(input: CreateUserInput): Promise<User>;
  requestPasswordReset(input: RequestPasswordResetInput): Promise<void>;
  confirmPasswordReset(input: ResetPasswordInput): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
}
