import type { AuthRepository } from "../AuthRepository";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginOutcome,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SelectTenantInput,
  Session,
  TenantOption,
} from "../../types/auth";
import { delay } from "../../utils/errors";
import { mockState } from "./state";

const DEMO_TOKENS = { accessToken: "demo-access-token", refreshToken: "demo-refresh-token" };
const DEMO_ACCOUNT_ID = "demo-account";

/**
 * Modo Demo nunca valida credenciais de verdade — qualquer envio do
 * formulário de login "entra" (spec: "Não validar usuário. Entrar
 * automaticamente."). O único uso do e-mail digitado é decidir se a
 * sessão é a de uma vendedora comum da empresa (botão "Entrar
 * (Empresa)") ou a do Admin GSM multi-tenant (botão "Admin GSM").
 *
 * `selectTenant`/`listTenants` existem só para satisfazer `AuthRepository`
 * (Fase 3 do backend) — o modo demo continua trocando de tenant pelo
 * mecanismo antigo (`AuthContext.switchTenant`/`mockState`), nunca por
 * aqui; ver `AuthProvider.tsx`.
 */
export class AuthMockRepository implements AuthRepository {
  async login(input: LoginInput): Promise<LoginOutcome> {
    await delay(300);
    const isGsmAdmin = input.email.trim().toLowerCase().includes("admin");
    if (isGsmAdmin) {
      const user: AuthUser = {
        id: "admin-gsm",
        accountId: DEMO_ACCOUNT_ID,
        tenantId: mockState.currentTenantId,
        email: "admin@gsmautomacao.com.br",
        name: "Admin GSM",
        role: "gsm_admin",
        mustChangePassword: false,
        isPlatformStaff: true,
      };
      return { requiresTenantSelection: false, session: { user, tokens: DEMO_TOKENS } };
    }
    const seed = mockState.users.find((u) => u.tenantId === mockState.currentTenantId) ?? mockState.users[0];
    if (!seed) throw new Error("Nenhum usuário demo configurado.");
    const user: AuthUser = {
      id: seed.id,
      accountId: DEMO_ACCOUNT_ID,
      tenantId: seed.tenantId ?? mockState.currentTenantId,
      email: seed.email,
      name: seed.name,
      role: seed.role,
      mustChangePassword: false,
      isPlatformStaff: false,
    };
    return { requiresTenantSelection: false, session: { user, tokens: DEMO_TOKENS } };
  }

  async selectTenant(input: SelectTenantInput): Promise<Session> {
    await delay(150);
    const user = await this.me("");
    return { user: { ...user, tenantId: input.tenantId }, tokens: DEMO_TOKENS };
  }

  async listTenants(_accessToken: string): Promise<TenantOption[]> {
    await delay(100);
    return mockState.tenants.map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      accountId: DEMO_ACCOUNT_ID,
      role: "admin",
    }));
  }

  async refresh(_refreshToken: string): Promise<Session> {
    await delay(150);
    const outcome = await this.login({ email: "demo@demo.com", password: "" });
    if (outcome.requiresTenantSelection) throw new Error("Sessão demo inválida.");
    return outcome.session;
  }

  async logout(_refreshToken: string): Promise<void> {
    await delay(100);
  }

  async me(_accessToken: string): Promise<AuthUser> {
    await delay(100);
    const seed = mockState.users[0];
    if (!seed) throw new Error("Nenhum usuário demo configurado.");
    return {
      id: seed.id,
      accountId: DEMO_ACCOUNT_ID,
      tenantId: seed.tenantId ?? mockState.currentTenantId,
      email: seed.email,
      name: seed.name,
      role: seed.role,
      mustChangePassword: false,
      isPlatformStaff: false,
    };
  }

  async requestPasswordReset(_input: RequestPasswordResetInput): Promise<void> {
    await delay(300);
  }

  async confirmPasswordReset(_input: ResetPasswordInput): Promise<void> {
    await delay(300);
  }

  async changePassword(_input: ChangePasswordInput): Promise<void> {
    await delay(200);
  }
}
