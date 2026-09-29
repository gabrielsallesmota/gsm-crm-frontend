import type { TokenResponse } from "../../types/auth";
import { createSessionClient } from "./sessionClient";

export const BASE_URL = import.meta.env.VITE_CRM_API_URL || "http://localhost:8010";

/**
 * Cliente HTTP único do app — toda a regra de sessão (refresh single-flight,
 * persistência do par renovado, 401 × 403 × rede) está em
 * `sessionClient.ts`, testável sem Vite. Esta fachada só mantém a API
 * pública de sempre para o resto do código.
 */
let storedTokensLoader: (() => TokenResponse | null) | null = null;

const client = createSessionClient(BASE_URL, (input, init) => fetch(input, init), {
  loadStoredTokens: () => storedTokensLoader?.() ?? null,
  // Web Locks: uma renovação por vez entre TODAS as abas do app. Sem
  // suporte (navegador antigo), cai no single-flight por aba + releitura do
  // storage em caso de recusa.
  withRefreshLock: (fn) =>
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("gsm_crm_refresh", fn)
      : fn(),
});

/** O `AuthProvider` (dono do storage) informa como ler o par salvo. */
export function setStoredTokensLoader(loader: (() => TokenResponse | null) | null): void {
  storedTokensLoader = loader;
}

export function setApiTokens(tokens: TokenResponse | null): void {
  client.setTokens(tokens);
}

export function setOnSessionExpired(cb: (() => void) | null): void {
  client.setOnSessionExpired(cb);
}

/** Chamado a cada renovação bem-sucedida — o `AuthProvider` persiste o
 * novo par. Antes o par renovado só vivia em memória: um F5 depois da
 * renovação tentava o refresh ANTIGO (já revogado pela rotação) e deslogava
 * o usuário. */
export function setOnTokensRefreshed(cb: ((tokens: TokenResponse) => void) | null): void {
  client.setOnTokensRefreshed(cb);
}

export function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string,
): Promise<T> {
  return client.json<T>(path, options, tokenOverride);
}

/**
 * Mesmo fluxo de auth/refresh de `apiRequest`, mas devolve o corpo como
 * texto cru em vez de fazer `.json()` — usado só pelo export CSV
 * (`GET /api/v1/prospects/export`), que não responde JSON.
 */
export function apiRequestText(path: string, options: RequestInit = {}): Promise<string> {
  return client.text(path, options);
}

/**
 * Mesmo fluxo de auth/refresh de `apiRequest`, mas devolve o corpo como
 * `Blob` — usado pelo download do contrato assinado (PDF), que não é JSON.
 */
export function apiRequestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  return client.blob(path, options);
}

export function currentAccessToken(): string | null {
  return client.currentAccessToken();
}

export function currentRefreshToken(): string | null {
  return client.currentRefreshToken();
}

/**
 * Sessão de SUPORTE (Etapa 2). Enquanto o staff da GSM está impersonando um
 * tenant, o cliente principal carrega o token de suporte (curto, sem
 * refresh) e ESTE cliente guarda a sessão real do staff — é por ele que
 * saem as chamadas do control plane (`/platform/*`: encerrar, elevar), que
 * recusam token de suporte. Fora do modo suporte, tudo usa o cliente
 * principal (nunca dois clientes renovando o mesmo refresh token).
 */
const staffClient = createSessionClient(BASE_URL, (input, init) => fetch(input, init));
let supportMode = false;

export function setSupportStaffTokens(tokens: TokenResponse | null): void {
  staffClient.setTokens(tokens);
  supportMode = tokens !== null;
}

export function setOnStaffTokensRefreshed(cb: ((tokens: TokenResponse) => void) | null): void {
  staffClient.setOnTokensRefreshed(cb);
}

export function setOnStaffSessionExpired(cb: (() => void) | null): void {
  staffClient.setOnSessionExpired(cb);
}

export function isSupportMode(): boolean {
  return supportMode;
}

/** Chamadas do control plane — sempre com a sessão REAL do staff. */
export function platformRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return supportMode ? staffClient.json<T>(path, options) : client.json<T>(path, options);
}

export function currentStaffTokens(): TokenResponse | null {
  const accessToken = staffClient.currentAccessToken();
  const refreshToken = staffClient.currentRefreshToken();
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}
