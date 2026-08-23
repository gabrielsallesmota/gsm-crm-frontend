export type UserRole = "admin" | "gestor" | "vendedor";

export interface User {
  id: string;
  /** Opcional: `GET /api/v1/users` (Fase 3) não devolve mais `tenant_id` por
   * membro — todo membro listado já é implicitamente do tenant atual.
   * Mantido opcional (não removido) só para não quebrar o mock de demo,
   * que ainda filtra usuários por tenant. */
  tenantId?: string;
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
