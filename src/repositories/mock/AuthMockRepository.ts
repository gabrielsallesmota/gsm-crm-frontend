import type { AuthRepository } from "../AuthRepository";
import type { AuthUser, LoginInput, Session } from "../../types/auth";
import type { User } from "../../types/user";
import { delay } from "../../utils/errors";
import { mockState, nextUserId } from "./state";

const DEMO_TOKENS = { accessToken: "demo-access-token", refreshToken: "demo-refresh-token" };

/**
 * Modo Demo nunca valida credenciais de verdade — qualquer envio do
 * formulário de login "entra" (spec: "Não validar usuário. Entrar
 * automaticamente."). O único uso do e-mail digitado é decidir se a
 * sessão é a de uma vendedora comum da empresa (botão "Entrar
 * (Empresa)") ou a do Admin GSM multi-tenant (botão "Admin GSM").
 */
export class AuthMockRepository implements AuthRepository {
  async login(input: LoginInput): Promise<Session> {
    await delay(300);
    const isGsmAdmin = input.email.trim().toLowerCase().includes("admin");
    if (isGsmAdmin) {
      const user: AuthUser = {
        id: "admin-gsm",
        tenantId: mockState.currentTenantId,
        email: "admin@gsmautomacao.com.br",
        name: "Admin GSM",
        role: "gsm_admin",
      };
      return { user, tokens: DEMO_TOKENS };
    }
    const seed = mockState.users.find((u) => u.tenantId === mockState.currentTenantId) ?? mockState.users[0];
    if (!seed) throw new Error("Nenhum usuário demo configurado.");
    const user: AuthUser = {
      id: seed.id,
      tenantId: seed.tenantId,
      email: seed.email,
      name: seed.name,
      role: seed.role,
    };
    return { user, tokens: DEMO_TOKENS };
  }

  async refresh(_refreshToken: string): Promise<Session> {
    await delay(150);
    return this.login({ email: "demo@demo.com", password: "" });
  }

  async logout(_refreshToken: string): Promise<void> {
    await delay(100);
  }

  async me(_accessToken: string): Promise<AuthUser> {
    await delay(100);
    const seed = mockState.users[0];
    if (!seed) throw new Error("Nenhum usuário demo configurado.");
    return { id: seed.id, tenantId: seed.tenantId, email: seed.email, name: seed.name, role: seed.role };
  }

  async listUsers(): Promise<User[]> {
    await delay(200);
    return mockState.users.filter((u) => u.tenantId === mockState.currentTenantId);
  }

  async createUser(input: Pick<User, "name" | "email" | "role" | "team">): Promise<User> {
    await delay(200);
    const user: User = {
      id: nextUserId(),
      tenantId: mockState.currentTenantId,
      name: input.name,
      email: input.email,
      team: input.team,
      role: input.role,
      bg: "rgba(74,163,255,.14)",
      color: "#4aa3ff",
    };
    mockState.users.push(user);
    return user;
  }
}
