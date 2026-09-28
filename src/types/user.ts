export type UserRole = "admin" | "gestor" | "vendedor";

export type MemberStatus = "active" | "suspended" | "invited";

/** Membro da equipe do tenant atual (`GET /api/v1/users`, admin/gestor). */
export interface User {
  id: string;
  /** Só o mock de demonstração usa. */
  tenantId?: string;
  name: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  /** Convite ainda não aceito / senha temporária ainda não trocada. */
  pendingFirstAccess: boolean;
  bg: string;
  color: string;
}

/** Versão mínima (sem e-mail) para o seletor de responsável — disponível
 * para qualquer papel (`GET /api/v1/users/directory`). */
export interface DirectoryMember {
  id: string;
  name: string;
  role: UserRole;
}

/** Sem `password` = convite por e-mail (recomendado). */
export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
}

export interface CreateUserResult {
  user: User;
  /** `true` convite enviado; `false` falhou (reenviar); `null` senha temporária. */
  invitationSent: boolean | null;
}

export interface UpdateMemberInput {
  role?: UserRole;
  active?: boolean;
}
