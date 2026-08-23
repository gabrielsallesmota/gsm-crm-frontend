import { createContext } from "react";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  TenantOption,
} from "../types/auth";
import type { Tenant } from "../types/tenant";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  // --- Demo apenas — nunca populado fora do modo demo, ver AuthProvider ---
  tenants: Tenant[];
  currentTenantId: string;
  currentTenant: Tenant | undefined;
  canSwitchTenant: boolean;
  switchTenant: (tenantId: string) => void;
  /** Nome do tenant atual — única fonte usada para EXIBIÇÃO fora do modo
   * demo (produção não tem `category`/cores de avatar por tenant, só
   * `tenantId`/`tenantName` via `GET /auth/tenants`). */
  currentTenantName: string | undefined;
  // --- Produção real (Fase 1-3 do backend) ---
  /** Tenants que a pessoa realmente acessa (`GET /auth/tenants`) — vazio até
   * carregar após o login. Nunca inclui tenant ao qual a pessoa não tem
   * `TenantMembership` ativa. */
  availableTenants: TenantOption[];
  /** Presente só entre o momento em que o login pediu seleção de tenant
   * (`requiresTenantSelection: true`) e a pessoa escolher um — nenhum token
   * operacional existe enquanto isto não for `null`. */
  pendingTenantSelection: { selectionToken: string; availableTenants: TenantOption[] } | null;
  /** Único caminho para trocar/selecionar o tenant ativo — sempre chama
   * `POST /auth/select-tenant` e substitui os tokens; nunca só estado
   * local (ver ADR "JWT Tenant Selection"). */
  selectTenant: (tenantId: string) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  markPasswordChanged: () => void;
  requestPasswordReset: (input: RequestPasswordResetInput) => Promise<void>;
  confirmPasswordReset: (input: ResetPasswordInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
}

// Só o Context + o tipo aqui — nenhum componente neste arquivo, de
// propósito (é o que deixa `AuthProvider.tsx` exportar só o componente,
// satisfazendo a regra `react-refresh/only-export-components`).
export const AuthContext = createContext<AuthContextValue | null>(null);
