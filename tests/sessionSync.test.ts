import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createSessionClient } from "../src/repositories/api/sessionClient.ts";
import { classifyExternalSessionChange, type StoredSession } from "../src/auth/sessionSync.ts";
import type { TokenResponse } from "../src/types/auth.ts";
import type { AuthUser } from "../src/types/auth.ts";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Backend com rotação de refresh (o usado deixa de valer), igual ao real. */
function rotatingBackend(opts: { refreshDelayMs?: number; refreshFails?: boolean } = {}) {
  let validAccess = "access-1";
  let validRefresh = "refresh-1";
  let generation = 1;
  let refreshCalls = 0;
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.endsWith("/api/v1/auth/refresh")) {
      refreshCalls += 1;
      if (opts.refreshDelayMs) await new Promise((r) => setTimeout(r, opts.refreshDelayMs));
      const body = JSON.parse(String(init?.body)) as { refresh_token: string };
      if (opts.refreshFails || body.refresh_token !== validRefresh) {
        return json(401, { detail: "Refresh token inválido ou revogado" });
      }
      generation += 1;
      validAccess = `access-${generation}`;
      validRefresh = `refresh-${generation}`;
      return json(200, { access_token: validAccess, refresh_token: validRefresh });
    }
    const auth = new Headers(init?.headers).get("Authorization");
    if (auth !== `Bearer ${validAccess}`)
      return json(401, { detail: "Token inválido ou expirado" });
    return json(200, { ok: true });
  };
  return {
    fetchImpl,
    expireAccess: () => {
      validAccess = "expired-on-server";
    },
    get refreshCalls() {
      return refreshCalls;
    },
  };
}

/** "localStorage" compartilhado + lock entre abas (equivalente ao Web Locks). */
function browser(withLock: boolean) {
  let stored: TokenResponse | null = { accessToken: "access-1", refreshToken: "refresh-1" };
  let chain: Promise<unknown> = Promise.resolve();
  const lock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };
  return {
    get stored() {
      return stored;
    },
    tab(backend: ReturnType<typeof rotatingBackend>) {
      const expired = { value: false };
      const client = createSessionClient("http://api", backend.fetchImpl, {
        loadStoredTokens: () => stored,
        ...(withLock ? { withRefreshLock: lock } : {}),
      });
      client.setTokens(stored);
      client.setOnTokensRefreshed((t) => {
        stored = t;
      });
      client.setOnSessionExpired(() => {
        expired.value = true;
      });
      return { client, expired };
    },
  };
}

describe("sessão multi-aba — refresh rotacionado", () => {
  it("aba B adota o par que a aba A renovou, sem gastar refresh nem deslogar", async () => {
    const backend = rotatingBackend();
    const nav = browser(true);
    const a = nav.tab(backend);
    const b = nav.tab(backend);
    backend.expireAccess();
    await a.client.json("/api/v1/leads");
    assert.equal(backend.refreshCalls, 1);
    // B ainda tem refresh-1 (revogado) em memória.
    backend.expireAccess();
    const res = await b.client.json<{ ok: boolean }>("/api/v1/leads");
    assert.deepEqual(res, { ok: true });
    assert.equal(b.expired.value, false);
    assert.equal(b.client.currentRefreshToken(), nav.stored?.refreshToken);
  });

  it("401 simultâneo em duas abas com lock → UMA renovação, ninguém desloga", async () => {
    const backend = rotatingBackend({ refreshDelayMs: 15 });
    const nav = browser(true);
    const a = nav.tab(backend);
    const b = nav.tab(backend);
    backend.expireAccess();
    const results = await Promise.all([
      a.client.json("/api/v1/leads"),
      b.client.json("/api/v1/tasks"),
      a.client.json("/api/v1/pipelines"),
      b.client.json("/api/v1/users/directory"),
    ]);
    assert.equal(results.length, 4);
    assert.equal(backend.refreshCalls, 1);
    assert.equal(a.expired.value, false);
    assert.equal(b.expired.value, false);
  });

  it("sem lock (navegador antigo): refresh recusado relê o storage antes de deslogar", async () => {
    const backend = rotatingBackend({ refreshDelayMs: 15 });
    const nav = browser(false);
    const a = nav.tab(backend);
    const b = nav.tab(backend);
    backend.expireAccess();
    await Promise.all([a.client.json("/x"), b.client.json("/y")]);
    // As duas abas tentaram; a perdedora adotou o par da vencedora.
    assert.equal(backend.refreshCalls, 2);
    assert.equal(a.expired.value, false);
    assert.equal(b.expired.value, false);
  });

  it("sessão realmente expirada (refresh recusado, storage igual) → desloga", async () => {
    const backend = rotatingBackend({ refreshFails: true });
    const nav = browser(true);
    const a = nav.tab(backend);
    backend.expireAccess();
    await assert.rejects(a.client.json("/api/v1/leads"));
    assert.equal(a.expired.value, true);
  });
});

describe("classifyExternalSessionChange (evento storage)", () => {
  const me = { id: "u1", tenantId: "t1" };
  const session = (id: string, tenantId: string): StoredSession => ({
    user: { id, tenantId } as AuthUser,
    tokens: { accessToken: "a", refreshToken: "r" },
  });

  it("logout em outra aba → logout aqui", () => {
    assert.equal(classifyExternalSessionChange(me, null), "logout");
  });
  it("sem sessão aqui e sem sessão lá → ignora", () => {
    assert.equal(classifyExternalSessionChange(null, null), "ignore");
  });
  it("mesmo usuário e tenant → só adota os tokens", () => {
    assert.equal(classifyExternalSessionChange(me, session("u1", "t1")), "adopt-tokens");
  });
  it("troca de tenant ou de usuário → recarrega (nada em memória sobrevive)", () => {
    assert.equal(classifyExternalSessionChange(me, session("u1", "t2")), "reload");
    assert.equal(classifyExternalSessionChange(me, session("u2", "t1")), "reload");
    assert.equal(classifyExternalSessionChange(null, session("u1", "t1")), "reload");
  });
});
