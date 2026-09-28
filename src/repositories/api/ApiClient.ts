import type { TokenResponse } from "../../types/auth";
import { createSessionClient } from "./sessionClient";

export const BASE_URL = import.meta.env.VITE_CRM_API_URL || "http://localhost:8010";

/**
 * Cliente HTTP único do app — toda a regra de sessão (refresh single-flight,
 * persistência do par renovado, 401 × 403 × rede) está em
 * `sessionClient.ts`, testável sem Vite. Esta fachada só mantém a API
 * pública de sempre para o resto do código.
 */
const client = createSessionClient(BASE_URL, (input, init) => fetch(input, init));

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
