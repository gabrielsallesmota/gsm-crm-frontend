import { createContext } from "react";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
} from "../types/auth";
import type { Tenant } from "../types/tenant";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  tenants: Tenant[];
  currentTenantId: string;
  currentTenant: Tenant | undefined;
  canSwitchTenant: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  markPasswordChanged: () => void;
  requestPasswordReset: (input: RequestPasswordResetInput) => Promise<void>;
  confirmPasswordReset: (input: ResetPasswordInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
}

// Só o Context + o tipo aqui — nenhum componente neste arquivo, de
// propósito (é o que deixa `AuthProvider.tsx` exportar só o componente,
// satisfazendo a regra `react-refresh/only-export-components`).
export const AuthContext = createContext<AuthContextValue | null>(null);
