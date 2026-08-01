export type UserRole = "admin" | "gestor" | "vendedor";

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  team: string;
  role: UserRole;
  bg: string;
  color: string;
}

export type CreateUserInput = Pick<User, "name" | "email" | "role" | "team"> & {
  password: string;
};
