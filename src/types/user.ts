export type UserRole = "admin" | "vendedor";

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
