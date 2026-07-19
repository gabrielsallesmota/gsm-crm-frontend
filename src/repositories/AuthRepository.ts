import type { AuthUser, LoginInput, Session } from "../types/auth";
import type { User } from "../types/user";

export interface AuthRepository {
  login(input: LoginInput): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  me(accessToken: string): Promise<AuthUser>;
  listUsers(): Promise<User[]>;
  createUser(input: Pick<User, "name" | "email" | "role" | "team">): Promise<User>;
}
