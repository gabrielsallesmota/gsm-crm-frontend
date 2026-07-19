import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, LoginInput, Session } from "../types/auth";
import type { Tenant } from "../types/tenant";
import { authService } from "../services/AuthService";
import { setApiTokens, setOnSessionExpired } from "../repositories/api/ApiClient";
import { mockState } from "../repositories/mock/state";
import { mockTenants } from "../mock/tenants";
import { isDemoMode } from "../services/factory";

const STORAGE_KEY = "gsm_crm_session";

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
}

export const AuthContext = createContext<AuthContextValue | null>(null);

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
    }
    setLoading(false);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      tenants: mockTenants,
      currentTenantId,
      currentTenant: mockTenants.find((t) => t.id === currentTenantId),
      canSwitchTenant: isDemoMode && user?.role === "gsm_admin",
      login,
      logout,
      switchTenant,
    }),
    [user, loading, currentTenantId, login, logout, switchTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
