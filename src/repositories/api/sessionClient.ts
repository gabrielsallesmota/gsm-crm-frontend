// Imports com extensão `.ts` de propósito: este módulo também roda direto
// no Node (`npm test`), sem Vite — ver tests/sessionClient.test.ts.
import { ApiError } from "../../types/common.ts";
import type { TokenResponse } from "../../types/auth.ts";
import { singleFlight } from "../../auth/singleFlight.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const NETWORK_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : "Erro ao comunicar com o servidor.";
  } catch {
    return "Erro ao comunicar com o servidor.";
  }
}

/**
 * Cliente HTTP com sessão (access + refresh) — a lógica que antes vivia
 * solta em `ApiClient.ts`, agora numa fábrica sem dependência do Vite para
 * ser testável. `ApiClient.ts` instancia UM cliente para o app inteiro.
 *
 * Regras de sessão (auditoria FE-P1-01):
 * - 401 → renova UMA vez e repete; renovações concorrentes são
 *   compartilhadas (single-flight) — o backend rotaciona o refresh a cada
 *   uso, então N renovações paralelas com o mesmo token deslogavam o
 *   usuário;
 * - todo par renovado é entregue a `onTokensRefreshed` (persistência);
 * - refresh recusado → `onSessionExpired` (logout); falha de REDE nunca
 *   desloga (vira `ApiError` status 0 com mensagem legível);
 * - 403 nunca dispara refresh nem logout: é "sem permissão"/"organização
 *   suspensa"/"troca de senha obrigatória" e sobe como `ApiError(403)`.
 */
export function createSessionClient(baseUrl: string, fetchImpl: FetchLike) {
  let accessToken: string | null = null;
  let refreshTokenValue: string | null = null;
  let onSessionExpired: (() => void) | null = null;
  let onTokensRefreshed: ((tokens: TokenResponse) => void) | null = null;

  async function rawRequest(
    path: string,
    options: RequestInit,
    tokenOverride?: string,
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    // `FormData` (upload de contrato) precisa que o browser gere o próprio
    // `Content-Type: multipart/form-data; boundary=...` — setar
    // "application/json" aqui quebraria o parsing multipart no backend.
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!headers.has("Content-Type") && options.body && !isFormData) {
      headers.set("Content-Type", "application/json");
    }
    const token = tokenOverride ?? accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    try {
      return await fetchImpl(`${baseUrl}${path}`, { ...options, headers });
    } catch {
      throw new ApiError(0, NETWORK_ERROR_MESSAGE);
    }
  }

  async function refreshOnce(): Promise<boolean> {
    if (!refreshTokenValue) return false;
    let resp: Response;
    try {
      resp = await fetchImpl(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });
    } catch {
      // Falha de rede não é "sessão expirada" — não desloga por isso.
      throw new ApiError(0, NETWORK_ERROR_MESSAGE);
    }
    if (!resp.ok) return false;
    const body = (await resp.json()) as { access_token: string; refresh_token: string };
    accessToken = body.access_token;
    refreshTokenValue = body.refresh_token;
    onTokensRefreshed?.({ accessToken: body.access_token, refreshToken: body.refresh_token });
    return true;
  }

  const tryRefresh = singleFlight(refreshOnce);

  async function requestWithRefresh(
    path: string,
    options: RequestInit,
    tokenOverride?: string,
  ): Promise<Response> {
    const sessionTokenAtStart = accessToken;
    const tokenUsed = tokenOverride ?? sessionTokenAtStart;
    // Token explícito que NÃO é o da sessão atual (ex.: o recém-emitido no
    // login, antes de a sessão ser aplicada) não pode disparar renovação da
    // sessão corrente.
    const belongsToSession = tokenOverride === undefined || tokenOverride === sessionTokenAtStart;
    let resp = await rawRequest(path, options, tokenOverride);
    if (resp.status === 401 && refreshTokenValue && belongsToSession) {
      // Outra requisição já renovou enquanto esta estava no ar → só repete.
      const refreshed = tokenUsed !== accessToken || (await tryRefresh());
      if (refreshed) {
        // Se a nova tentativa AINDA voltar 401, é regra de negócio do
        // endpoint (ex.: senha atual incorreta em /auth/change-password),
        // não sessão expirada — não desloga, só deixa o ApiError subir.
        resp = await rawRequest(path, options);
      } else {
        onSessionExpired?.();
      }
    }
    return resp;
  }

  async function ensureOk(resp: Response): Promise<Response> {
    if (!resp.ok) throw new ApiError(resp.status, await readErrorDetail(resp));
    return resp;
  }

  return {
    setTokens(tokens: TokenResponse | null): void {
      accessToken = tokens?.accessToken ?? null;
      refreshTokenValue = tokens?.refreshToken ?? null;
    },
    setOnSessionExpired(cb: (() => void) | null): void {
      onSessionExpired = cb;
    },
    setOnTokensRefreshed(cb: ((tokens: TokenResponse) => void) | null): void {
      onTokensRefreshed = cb;
    },
    currentAccessToken: (): string | null => accessToken,
    currentRefreshToken: (): string | null => refreshTokenValue,
    async json<T>(path: string, options: RequestInit = {}, tokenOverride?: string): Promise<T> {
      const resp = await ensureOk(await requestWithRefresh(path, options, tokenOverride));
      if (resp.status === 204) return undefined as T;
      return (await resp.json()) as T;
    },
    async text(path: string, options: RequestInit = {}): Promise<string> {
      return (await ensureOk(await requestWithRefresh(path, options))).text();
    },
    async blob(path: string, options: RequestInit = {}): Promise<Blob> {
      return (await ensureOk(await requestWithRefresh(path, options))).blob();
    },
  };
}

export type SessionClient = ReturnType<typeof createSessionClient>;
