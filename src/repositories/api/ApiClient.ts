import { ApiError } from "../../types/common";
import type { TokenResponse } from "../../types/auth";

const BASE_URL = import.meta.env.VITE_CRM_API_URL || "http://localhost:8010";

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

async function rawRequest(path: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let resp = await rawRequest(path, options);
  if (resp.status === 401 && refreshTokenValue) {
    const refreshed = await tryRefresh();
    resp = refreshed ? await rawRequest(path, options) : resp;
  }
  if (resp.status === 401) {
    onSessionExpired?.();
  }
  if (!resp.ok) {
    throw new ApiError(resp.status, await readErrorDetail(resp));
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export function currentAccessToken(): string | null {
  return accessToken;
}

export function currentRefreshToken(): string | null {
  return refreshTokenValue;
}
