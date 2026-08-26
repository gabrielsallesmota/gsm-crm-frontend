import { ApiError } from "../../types/common";
import type { TokenResponse } from "../../types/auth";

export const BASE_URL = import.meta.env.VITE_CRM_API_URL || "http://localhost:8010";

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setApiTokens(tokens: TokenResponse | null): void {
  accessToken = tokens?.accessToken ?? null;
  refreshTokenValue = tokens?.refreshToken ?? null;
}

export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb;
}

async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : "Erro ao comunicar com o servidor.";
  } catch {
    return "Erro ao comunicar com o servidor.";
  }
}

async function rawRequest(path: string, options: RequestInit, tokenOverride?: string): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = tokenOverride ?? accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshTokenValue) return false;
  const resp = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  });
  if (!resp.ok) return false;
  const body = (await resp.json()) as { access_token: string; refresh_token: string };
  accessToken = body.access_token;
  refreshTokenValue = body.refresh_token;
  return true;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string,
): Promise<T> {
  let resp = await rawRequest(path, options, tokenOverride);
  if (resp.status === 401 && refreshTokenValue) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Token renovado com sucesso — a sessão é válida. Se a nova
      // tentativa AINDA voltar 401, é um 401 de regra de negócio do
      // próprio endpoint (ex.: senha atual incorreta em
      // /auth/change-password), não sessão expirada — não desloga o
      // usuário por isso, só deixa o ApiError subir pra tela tratar.
      resp = await rawRequest(path, options, tokenOverride);
    } else {
      onSessionExpired?.();
    }
  }
  if (!resp.ok) {
    throw new ApiError(resp.status, await readErrorDetail(resp));
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

/**
 * Mesmo fluxo de auth/refresh de `apiRequest`, mas devolve o corpo como
 * texto cru em vez de fazer `.json()` — usado só pelo export CSV
 * (`GET /api/v1/prospects/export`), que não responde JSON.
 */
export async function apiRequestText(path: string, options: RequestInit = {}): Promise<string> {
  let resp = await rawRequest(path, options);
  if (resp.status === 401 && refreshTokenValue) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      resp = await rawRequest(path, options);
    } else {
      onSessionExpired?.();
    }
  }
  if (!resp.ok) {
    throw new ApiError(resp.status, await readErrorDetail(resp));
  }
  return resp.text();
}

export function currentAccessToken(): string | null {
  return accessToken;
}

export function currentRefreshToken(): string | null {
  return refreshTokenValue;
}
