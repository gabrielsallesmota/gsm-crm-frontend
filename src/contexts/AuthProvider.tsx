import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  Session,
} from "../types/auth";
import { authService } from "../services/AuthService";
import { setApiTokens, setOnSessionExpired } from "../repositories/api/ApiClient";
import { mockState } from "../repositories/mock/state";
import { mockTenants } from "../mock/tenants";
import { isDemoMode } from "../services/factory";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import type { Tenant } from "../types/tenant";

const STORAGE_KEY = "gsm_crm_session";

// Referência estável (não um array literal novo a cada render) — ver uso
// em `tenants` abaixo, evita invalidar o `useMemo` de `value` sem motivo.
const EMPTY_TENANTS: Tenant[] = [];

interface StoredSession {
  user: AuthUser;
  tokens: Session["tokens"];
}

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession | null): void {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<Session["tokens"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState<string>(mockState.currentTenantId);

  useEffect(() => {
    const stored = loadStoredSession();
    if (stored) {
      setUser(stored.user);
      setTokens(stored.tokens);
      setApiTokens(stored.tokens);
      setCurrentTenantId(stored.user.tenantId);
      mockState.currentTenantId = stored.user.tenantId;
      setLoading(false);
    } else if (isDemoMode) {
      // Modo demo: entra automaticamente como a empresa de demonstração,
      // sem passar pela tela de login fictícia.
      authService
        .login({ email: "voce@empresa.com.br", password: "demodemo" })
        .then((session) => {
          setUser(session.user);
          setTokens(session.tokens);
          setApiTokens(session.tokens);
          setCurrentTenantId(session.user.tenantId);
          mockState.currentTenantId = session.user.tenantId;
          saveStoredSession(session);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    setOnSessionExpired(() => {
      setUser(null);
      setTokens(null);
      saveStoredSession(null);
    });
    return () => setOnSessionExpired(null);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await authService.login(input);
    setUser(session.user);
    setTokens(session.tokens);
    setApiTokens(session.tokens);
    setCurrentTenantId(session.user.tenantId);
    mockState.currentTenantId = session.user.tenantId;
    saveStoredSession(session);
  }, []);

  const logout = useCallback(async () => {
    if (tokens) await authService.logout(tokens.refreshToken).catch(() => undefined);
    setUser(null);
    setTokens(null);
    setApiTokens(null);
    saveStoredSession(null);
  }, [tokens]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      if (!isDemoMode) return;
      setCurrentTenantId(tenantId);
      mockState.currentTenantId = tenantId;
    },
    [],
  );

  const markPasswordChanged = useCallback(() => {
    if (!user) return;
    const updated = { ...user, mustChangePassword: false };
    setUser(updated);
    if (tokens) saveStoredSession({ user: updated, tokens });
  }, [user, tokens]);

  const requestPasswordReset = useCallback((input: RequestPasswordResetInput) => {
    return authService.requestPasswordReset(input);
  }, []);

  const confirmPasswordReset = useCallback((input: ResetPasswordInput) => {
    return authService.confirmPasswordReset(input);
  }, []);

  const changePassword = useCallback((input: ChangePasswordInput) => {
    return authService.changePassword(input);
  }, []);

  // A troca de tenant (`mockTenants`) é um recurso exclusivo do modo demo
  // (ver `canSwitchTenant` abaixo) — em produção cada usuário pertence a um
  // único tenant real, e hoje o backend não expõe nome/categoria desse
  // tenant (só `tenantId` via JWT/`/auth/me`, ver `types/auth.ts`). Usar a
  // lista fake aqui em produção faria `currentTenant` resolver para
  // `undefined` silenciosamente (o `tenantId` real nunca bate com
  // "c1"/"c2"/"c3") — melhor não fingir que existe um tenant selecionável
  // até o backend ganhar um jeito de expor o nome do tenant do usuário.
  const tenants = isDemoMode ? mockTenants : EMPTY_TENANTS;
  const currentTenant = isDemoMode ? mockTenants.find((t) => t.id === currentTenantId) : undefined;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      tenants,
      currentTenantId,
      currentTenant,
      canSwitchTenant: isDemoMode && user?.role === "gsm_admin",
      login,
      logout,
      switchTenant,
      markPasswordChanged,
      requestPasswordReset,
      confirmPasswordReset,
      changePassword,
    }),
    [
      user,
      loading,
      tenants,
      currentTenantId,
      currentTenant,
      login,
      logout,
      switchTenant,
      markPasswordChanged,
      requestPasswordReset,
      confirmPasswordReset,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
