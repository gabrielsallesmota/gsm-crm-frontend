import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  Session,
  TenantOption,
} from "../types/auth";
import { authService } from "../services/AuthService";
import { setApiTokens, setOnSessionExpired } from "../repositories/api/ApiClient";
import { mockState } from "../repositories/mock/state";
import { mockTenants } from "../mock/tenants";
import { isDemoMode } from "../services/factory";
import { ROUTES } from "../constants/routes";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import type { Tenant } from "../types/tenant";

const STORAGE_KEY = "gsm_crm_session";
// Referência estável (não um array literal novo a cada render) — evita
// invalidar o `useMemo` de `value` sem motivo fora do modo demo.
const EMPTY_TENANTS: Tenant[] = [];

interface StoredSession {
  user: AuthUser;
  tokens: Session["tokens"];
}

interface PendingSelection {
  selectionToken: string;
  availableTenants: TenantOption[];
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
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  // Só populado fora do modo demo (`GET /auth/tenants`) — ver `refreshAvailableTenants`.
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);

  // Fonte única do tenant atual: sempre `user.tenantId` (o que o backend
  // colocou no token). Não existe mais um `currentTenantId` separado que
  // pudesse divergir de `user.tenantId` — essa era exatamente a duplicação
  // de estado que este provider tinha antes da auditoria (o `switchTenant`
  // do modo demo atualizava um `currentTenantId` próprio sem nunca
  // atualizar `user.tenantId`).
  const currentTenantId = user?.tenantId ?? mockState.currentTenantId;

  const applySession = useCallback((session: Session) => {
    setUser(session.user);
    setTokens(session.tokens);
    setApiTokens(session.tokens);
    mockState.currentTenantId = session.user.tenantId;
    saveStoredSession(session);
    setPendingSelection(null);
  }, []);

  // Best-effort, não bloqueia a UI — alimenta o seletor de tenant real
  // (`GET /auth/tenants`). Nunca roda em modo demo (que tem seu próprio
  // mecanismo, ver `switchTenant`).
  const refreshAvailableTenants = useCallback((accessToken: string) => {
    if (isDemoMode) return;
    authService
      .listTenants(accessToken)
      .then(setAvailableTenants)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const stored = loadStoredSession();
    if (stored) {
      setUser(stored.user);
      setTokens(stored.tokens);
      setApiTokens(stored.tokens);
      mockState.currentTenantId = stored.user.tenantId;
      refreshAvailableTenants(stored.tokens.accessToken);
      setLoading(false);
    } else if (isDemoMode) {
      // Modo demo: entra automaticamente como a empresa de demonstração,
      // sem passar pela tela de login fictícia.
      authService
        .login({ email: "voce@empresa.com.br", password: "demodemo" })
        .then((outcome) => {
          if (!outcome.requiresTenantSelection) applySession(outcome.session);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    setOnSessionExpired(() => {
      setUser(null);
      setTokens(null);
      setAvailableTenants([]);
      saveStoredSession(null);
    });
    return () => setOnSessionExpired(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const outcome = await authService.login(input);
      if (outcome.requiresTenantSelection) {
        // Nenhum token operacional existe ainda — só o de seleção, curto e
        // sem `tenant_id`/`role` nenhum (ver ADR "JWT Tenant Selection").
        setPendingSelection({
          selectionToken: outcome.selectionToken,
          availableTenants: outcome.availableTenants,
        });
        return;
      }
      applySession(outcome.session);
      refreshAvailableTenants(outcome.session.tokens.accessToken);
    },
    [applySession, refreshAvailableTenants],
  );

  const logout = useCallback(async () => {
    if (tokens) await authService.logout(tokens.refreshToken).catch(() => undefined);
    setUser(null);
    setTokens(null);
    setApiTokens(null);
    setAvailableTenants([]);
    setPendingSelection(null);
    saveStoredSession(null);
  }, [tokens]);

  // Único caminho real de troca/seleção de tenant — SEMPRE chama
  // POST /auth/select-tenant e substitui os tokens; nunca só estado local
  // (ver ADR "JWT Tenant Selection"). Cobre tanto a seleção logo após o
  // login (`pendingSelection.selectionToken`) quanto a troca numa sessão já
  // ativa (`tokens.refreshToken`).
  const selectTenant = useCallback(
    async (tenantId: string) => {
      if (isDemoMode) {
        // Modo demo preserva o mecanismo antigo — nunca chama o backend.
        setUser((prev) => (prev ? { ...prev, tenantId } : prev));
        mockState.currentTenantId = tenantId;
        return;
      }
      const session = await authService.selectTenant({
        tenantId,
        selectionToken: pendingSelection?.selectionToken,
        refreshToken: pendingSelection ? undefined : (tokens?.refreshToken ?? undefined),
      });
      applySession(session);
      refreshAvailableTenants(session.tokens.accessToken);
      // Recarrega a página inteira: qualquer dado de leads/pipelines/etc já
      // buscado para o tenant anterior não deve permanecer em memória — mais
      // simples e mais seguro que tentar invalidar cache de cada hook
      // individualmente.
      window.location.assign(ROUTES.dashboard);
    },
    [applySession, pendingSelection, refreshAvailableTenants, tokens],
  );

  // Mantido só para o modo demo (nome preservado por compatibilidade com
  // `AppLayout`/telas existentes) — produção usa `selectTenant`.
  const switchTenant = useCallback((tenantId: string) => {
    if (!isDemoMode) return;
    setUser((prev) => (prev ? { ...prev, tenantId } : prev));
    mockState.currentTenantId = tenantId;
  }, []);

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

  const tenants = isDemoMode ? mockTenants : EMPTY_TENANTS;
  const currentTenant = isDemoMode ? mockTenants.find((t) => t.id === currentTenantId) : undefined;
  const currentTenantName = isDemoMode
    ? currentTenant?.name
    : (availableTenants.find((t) => t.tenantId === currentTenantId)?.tenantName ?? user?.tenantId);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      tenants,
      currentTenantId,
      currentTenant,
      canSwitchTenant: isDemoMode && user?.role === "gsm_admin",
      switchTenant,
      currentTenantName,
      availableTenants,
      pendingTenantSelection: pendingSelection,
      selectTenant,
      login,
      logout,
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
      switchTenant,
      currentTenantName,
      availableTenants,
      pendingSelection,
      selectTenant,
      login,
      logout,
      markPasswordChanged,
      requestPasswordReset,
      confirmPasswordReset,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
