// Imports com extensão `.ts` de propósito: este módulo também roda direto
// no Node (`npm test`), sem Vite — ver tests/sessionClient.test.ts.
import { ApiError } from "../../types/common.ts";
import type { TokenResponse } from "../../types/auth.ts";
import { singleFlight } from "../../auth/singleFlight.ts";
import { readableDetail } from "../../utils/apiErrors.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Integração com OUTRAS abas do mesmo navegador (Etapa 1). */
export interface SessionSyncOptions {
  /** Par salvo no storage compartilhado agora (pode ter sido rotacionado
   * por outra aba). */
  loadStoredTokens?: () => TokenResponse | null;
  /** Serializa a renovação ENTRE abas (Web Locks no browser). */
  withRefreshLock?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const NETWORK_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown };
    // 422 do FastAPI vem como lista — vira uma frase legível.
    return readableDetail(body.detail, "Erro ao comunicar com o servidor.");
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
 *   suspensa"/"troca de senha obrigatória" e sobe como `ApiError(403)`;
 * - multi-aba (Etapa 1): o refresh é rotacionado — se a aba A renovou, o
 *   refresh em memória da aba B já foi revogado. Antes de renovar (e antes
 *   de declarar a sessão expirada) o cliente ADOTA o par mais novo do
 *   storage compartilhado; a renovação roda sob um lock entre abas, então
 *   duas abas nunca gastam o mesmo refresh ao mesmo tempo.
 */
export function createSessionClient(
  baseUrl: string,
  fetchImpl: FetchLike,
  sync: SessionSyncOptions = {},
) {
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

  /** Outra aba já rotacionou o par? Adota o do storage (sem gastar um
   * refresh) e devolve true. */
  function adoptNewerStoredTokens(): boolean {
    const stored = sync.loadStoredTokens?.() ?? null;
    if (!stored || stored.refreshToken === refreshTokenValue) return false;
    accessToken = stored.accessToken;
    refreshTokenValue = stored.refreshToken;
    return true;
  }

  /** "adopted" = par de outra aba (o access pode também já ter expirado);
   * "refreshed" = renovado agora; false = sessão expirada. */
  type RefreshOutcome = "adopted" | "refreshed" | false;

  async function refreshOnce(): Promise<RefreshOutcome> {
    return sync.withRefreshLock ? sync.withRefreshLock(refreshUnderLock) : refreshUnderLock();
  }

  async function refreshUnderLock(): Promise<RefreshOutcome> {
    if (adoptNewerStoredTokens()) return "adopted";
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
    // Recusado: pode ter sido rotacionado por outra aba no meio do caminho
    // (navegador sem Web Locks) — só é "expirada" se o storage não tiver
    // nada mais novo.
    if (!resp.ok) return adoptNewerStoredTokens() ? "adopted" : false;
    const body = (await resp.json()) as { access_token: string; refresh_token: string };
    accessToken = body.access_token;
    refreshTokenValue = body.refresh_token;
    onTokensRefreshed?.({ accessToken: body.access_token, refreshToken: body.refresh_token });
    return "refreshed";
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
      let outcome: RefreshOutcome = tokenUsed !== accessToken ? "adopted" : await tryRefresh();
      if (outcome) {
        resp = await rawRequest(path, options);
        // Par herdado (de outra requisição/aba) também já expirado → agora
        // sim renova de verdade, uma vez.
        if (resp.status === 401 && outcome === "adopted") {
          outcome = await tryRefresh();
          if (outcome) resp = await rawRequest(path, options);
          else onSessionExpired?.();
        }
        // Se a nova tentativa AINDA voltar 401, é regra de negócio do
        // endpoint (ex.: senha atual incorreta em /auth/change-password),
        // não sessão expirada — não desloga, só deixa o ApiError subir.
      } else {
        onSessionExpired?.();
      }
    } else if (resp.status === 401 && belongsToSession && tokenUsed && !refreshTokenValue) {
      // Sessão SEM refresh (token de suporte da GSM, Etapa 2): 401 é o fim
      // dela (encerrada ou expirada). Avisa para o app voltar à sessão real
      // do staff em vez de ficar só acumulando erros.
      onSessionExpired?.();
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
