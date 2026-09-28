import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { singleFlight } from "../src/auth/singleFlight.ts";
import {
  NETWORK_ERROR_MESSAGE,
  createSessionClient,
} from "../src/repositories/api/sessionClient.ts";
import { ApiError } from "../src/types/common.ts";
import { resolveCrmMode } from "../src/services/modeResolution.ts";

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Backend falso: access token válido é sempre o último emitido; refresh
 * rotaciona (o token usado deixa de valer), como o backend real. */
function fakeBackend(opts: { refreshDelayMs?: number; refreshFails?: boolean } = {}) {
  let validAccess = "access-1";
  let validRefresh = "refresh-1";
  let refreshCalls = 0;
  let generation = 1;
  const handler: Handler = async (url, init) => {
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
    if (auth !== `Bearer ${validAccess}`) return json(401, { detail: "Token inválido ou expirado" });
    if (url.endsWith("/forbidden")) {
      return json(403, { detail: "Você não tem permissão para executar esta ação" });
    }
    return json(200, { ok: true });
  };
  return {
    handler,
    expireAccess: () => {
      validAccess = "expired-on-server";
    },
    get refreshCalls() {
      return refreshCalls;
    },
  };
}

function clientFor(handler: Handler) {
  const client = createSessionClient("http://api", (input, init) =>
    Promise.resolve(handler(input, init)),
  );
  client.setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
  return client;
}

describe("sessionClient — 401 e renovação de sessão", () => {
  it("401 → renova uma vez, repete a requisição e entrega o par novo para persistir", async () => {
    const backend = fakeBackend();
    const client = clientFor(backend.handler);
    const persisted: string[] = [];
    client.setOnTokensRefreshed((t) => persisted.push(t.refreshToken));
    backend.expireAccess();

    const result = await client.json<{ ok: boolean }>("/api/v1/leads");
    assert.deepEqual(result, { ok: true });
    assert.equal(backend.refreshCalls, 1);
    assert.deepEqual(persisted, ["refresh-2"]);
    assert.equal(client.currentRefreshToken(), "refresh-2");
  });

  it("vários 401 simultâneos compartilham UMA renovação (não desloga ninguém)", async () => {
    const backend = fakeBackend({ refreshDelayMs: 20 });
    const client = clientFor(backend.handler);
    let expired = false;
    client.setOnSessionExpired(() => {
      expired = true;
    });
    backend.expireAccess();

    const results = await Promise.all(
      ["/a", "/b", "/c", "/d", "/e"].map((p) => client.json<{ ok: boolean }>(p)),
    );
    assert.equal(results.every((r) => r.ok), true);
    assert.equal(backend.refreshCalls, 1);
    assert.equal(expired, false);
  });

  it("refresh recusado → sessão expirada (logout) e ApiError 401", async () => {
    const backend = fakeBackend({ refreshFails: true });
    const client = clientFor(backend.handler);
    let expired = false;
    client.setOnSessionExpired(() => {
      expired = true;
    });
    backend.expireAccess();

    await assert.rejects(client.json("/api/v1/leads"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      return true;
    });
    assert.equal(expired, true);
  });

  it("403 nunca renova nem desloga: sobe a mensagem do backend", async () => {
    const backend = fakeBackend();
    const client = clientFor(backend.handler);
    let expired = false;
    client.setOnSessionExpired(() => {
      expired = true;
    });

    await assert.rejects(client.json("/forbidden"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 403);
      assert.equal(err.message, "Você não tem permissão para executar esta ação");
      return true;
    });
    assert.equal(backend.refreshCalls, 0);
    assert.equal(expired, false);
  });

  it("falha de rede não desloga e vira mensagem legível", async () => {
    const client = createSessionClient("http://api", () => Promise.reject(new TypeError("Failed to fetch")));
    client.setTokens({ accessToken: "a", refreshToken: "r" });
    let expired = false;
    client.setOnSessionExpired(() => {
      expired = true;
    });
    await assert.rejects(client.json("/api/v1/leads"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 0);
      assert.equal(err.message, NETWORK_ERROR_MESSAGE);
      return true;
    });
    assert.equal(expired, false);
  });

  it("token explícito que não é da sessão (ex.: logo após o login) não dispara refresh", async () => {
    const backend = fakeBackend();
    const client = clientFor(backend.handler);
    await assert.rejects(client.json("/api/v1/auth/me", {}, "token-de-outra-sessao"));
    assert.equal(backend.refreshCalls, 0);
  });
});

describe("singleFlight", () => {
  it("reexecuta depois que a execução anterior termina (inclusive com erro)", async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
      if (calls === 1) throw new Error("falhou");
      return calls;
    });
    await assert.rejects(run());
    assert.equal(await run(), 2);
  });
});

describe("resolveCrmMode — demo nunca por acidente", () => {
  it("produção é o padrão para qualquer domínio", () => {
    assert.equal(resolveCrmMode(undefined, "app.cliente.com.br"), "production");
    assert.equal(resolveCrmMode(undefined, "crm.gsmautomacao.com.br"), "production");
    assert.equal(resolveCrmMode(undefined, "localhost"), "production");
  });

  it("demo só explícito ou em demo.*", () => {
    assert.equal(resolveCrmMode("demo", "app.cliente.com.br"), "demo");
    assert.equal(resolveCrmMode(undefined, "demo.gsmautomacao.com.br"), "demo");
    assert.equal(resolveCrmMode("production", "demo.gsmautomacao.com.br"), "production");
  });
});
