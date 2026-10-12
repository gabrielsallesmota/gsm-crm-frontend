// CRM-003B.4 a B.6 — lógica pura das conexões Google/Microsoft: contratos do
// backend, retorno do OAuth, provedor lembrado por state, mailto e links.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasFeature } from "../src/auth/features.ts";
import {
  buildMailtoUrl,
  canSyncNow,
  connectionAttention,
  eligibleTargets,
  isUsableOAuthReturn,
  parseOAuthReturn,
  reconnectFeatures,
  rememberPendingProvider,
  safeExternalUrl,
  sourceLabel,
  stateFromAuthorizationUrl,
  takePendingProvider,
  toCallbackResult,
  toConnection,
  toOverview,
  toPublished,
} from "../src/utils/connections.ts";
import type { Connection } from "../src/types/connections.ts";

const dto = (extra: Record<string, unknown> = {}) => ({
  id: "c1",
  provider: "google",
  account_email: "ana@example.com",
  status: "active",
  needs_reconnect: false,
  calendar_enabled: true,
  tasks_enabled: true,
  automatic_sync_enabled: true,
  manual_sync_enabled: true,
  interval_minutes: 15,
  selected_calendars: [{ id: "cal-1", name: "Pessoal" }],
  selected_task_lists: [],
  sync_status: "succeeded",
  last_sync_finished_at: "2026-10-12T10:00:00Z",
  last_success_at: "2026-10-12T10:00:00Z",
  next_sync_at: null,
  consecutive_failures: 0,
  last_error_code: null,
  last_error_message: null,
  ...extra,
});

const conn = (extra: Record<string, unknown> = {}): Connection => toConnection(dto(extra));

class MemoryStore {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("contratos do backend", () => {
  it("mapeia a conexão sem inventar campos de segredo", () => {
    const c = conn();
    assert.equal(c.accountEmail, "ana@example.com");
    assert.equal(c.intervalMinutes, 15);
    assert.deepEqual(c.selectedCalendars, [{ id: "cal-1", name: "Pessoal" }]);
    assert.equal(c.syncStatus, "succeeded");
    assert.ok(!("accessToken" in c) && !("refreshToken" in c));
  });

  it("estado desconhecido vira 'waiting' e provedor desconhecido nunca quebra", () => {
    assert.equal(conn({ sync_status: "???" }).syncStatus, "waiting");
    assert.equal(toConnection(null).provider, "google");
    assert.deepEqual(toConnection({}).selectedCalendars, []);
  });

  it("política e provedores: ausência não bloqueia nem libera por acidente", () => {
    const o = toOverview({
      providers: [{ provider: "microsoft", label: "Microsoft", configured: false, allowed: true, features: ["calendar", "x"] }],
      policy: { google_allowed: false, microsoft_allowed: true, persisted: true },
    });
    assert.equal(o.providers[0]?.configured, false);
    assert.deepEqual(o.providers[0]?.features, ["calendar"]);
    assert.equal(o.policy.googleAllowed, false);
    assert.equal(toOverview({}).policy.googleAllowed, true);
  });

  it("retorno do consentimento traz as funcionalidades não concedidas", () => {
    const r = toCallbackResult({ connection: dto(), missing_features: ["tasks", "email"] });
    assert.deepEqual(r.missingFeatures, ["tasks"]);
  });

  it("publicação: falha do provedor aparece como 'failed'", () => {
    const p = toPublished({ kind: "task", item_id: "i1", push_status: "failed", error_message: "x" });
    assert.equal(p.pushStatus, "failed");
    assert.equal(p.kind, "task");
    assert.equal(toPublished({}).pushStatus, "failed");
  });
});

describe("retorno do OAuth", () => {
  it("lê state/code e state/error", () => {
    const ok = parseOAuthReturn("?state=abc&code=xyz");
    assert.deepEqual(ok, { state: "abc", code: "xyz", error: null, errorDescription: null });
    assert.ok(isUsableOAuthReturn(ok));
    const denied = parseOAuthReturn("?state=abc&error=access_denied&error_description=n%C3%A3o");
    assert.ok(isUsableOAuthReturn(denied));
    assert.equal(denied.errorDescription, "não");
  });

  it("sem state ou sem code/error não é um retorno válido", () => {
    assert.ok(!isUsableOAuthReturn(parseOAuthReturn("")));
    assert.ok(!isUsableOAuthReturn(parseOAuthReturn("?code=xyz")));
    assert.ok(!isUsableOAuthReturn(parseOAuthReturn("?state=abc")));
    assert.ok(!isUsableOAuthReturn(parseOAuthReturn("?state=%20&code=1")));
  });

  it("o provedor é lembrado por state e só uma vez", () => {
    const store = new MemoryStore();
    const state = stateFromAuthorizationUrl("https://accounts.example/auth?x=1&state=ST-1&y=2");
    assert.equal(state, "ST-1");
    rememberPendingProvider("ST-1", "microsoft", store);
    assert.equal(takePendingProvider("ST-1", store), "microsoft");
    assert.equal(takePendingProvider("ST-1", store), null);
    assert.equal(takePendingProvider("outro", store), null);
    assert.equal(stateFromAuthorizationUrl("não é url"), null);
  });

  it("sem storage disponível não quebra", () => {
    rememberPendingProvider("s", "google", null);
    assert.equal(takePendingProvider("s", null), null);
  });
});

describe("estado da conexão", () => {
  it("precisa de seleção para sincronizar agora", () => {
    assert.equal(canSyncNow(conn()), true);
    assert.equal(canSyncNow(conn({ selected_calendars: [] })), false);
    assert.equal(canSyncNow(conn({ manual_sync_enabled: false })), false);
    assert.equal(canSyncNow(conn({ needs_reconnect: true })), false);
    assert.equal(canSyncNow(conn({ sync_status: "running" })), false);
    // Seleção de uma funcionalidade desligada não conta.
    assert.equal(
      canSyncNow(conn({ calendar_enabled: false, tasks_enabled: false })),
      false,
    );
  });

  it("explica o que fazer quando precisa de atenção", () => {
    assert.match(connectionAttention(conn({ needs_reconnect: true })) ?? "", /Conecte novamente/);
    assert.equal(connectionAttention(conn({ sync_status: "failed", last_error_message: "Limite do provedor" })), "Limite do provedor");
    assert.equal(connectionAttention(conn()), null);
  });

  it("reconectar pede o que a conta já usava", () => {
    assert.deepEqual(reconnectFeatures(conn({ tasks_enabled: false })), ["calendar"]);
    assert.deepEqual(reconnectFeatures(conn({ calendar_enabled: false, tasks_enabled: false })), ["calendar", "tasks"]);
  });

  it("destinos de publicação: ativos, com funcionalidade ligada e seleção", () => {
    const withTasks = conn({ selected_task_lists: [{ id: "l", name: "L" }] });
    const reconnect = conn({ id: "c2", needs_reconnect: true });
    const noSel = conn({ id: "c3", selected_calendars: [] });
    const list = [withTasks, reconnect, noSel];
    assert.deepEqual(eligibleTargets(list, "event").map((c) => c.id), ["c1"]);
    assert.deepEqual(eligibleTargets(list, "task").map((c) => c.id), ["c1"]);
    assert.deepEqual(eligibleTargets([conn({ selected_task_lists: [] })], "task"), []);
  });
});

describe("links e e-mail", () => {
  it("só abre links http(s) do provedor", () => {
    assert.equal(safeExternalUrl("https://calendar.google.com/e/1"), "https://calendar.google.com/e/1");
    assert.equal(safeExternalUrl("javascript:alert(1)"), null);
    assert.equal(safeExternalUrl("data:text/html,x"), null);
    assert.equal(safeExternalUrl(null), null);
    assert.equal(safeExternalUrl("lixo"), null);
  });

  it("mailto abre o rascunho e nada mais", () => {
    assert.equal(buildMailtoUrl("ana@example.com"), "mailto:ana@example.com");
    assert.equal(
      buildMailtoUrl("ana@example.com", { subject: "Proposta GSM & CRM", body: "Olá,\r\nTudo bem?" }),
      "mailto:ana@example.com?subject=Proposta%20GSM%20%26%20CRM&body=Ol%C3%A1%2C%0ATudo%20bem%3F",
    );
  });

  it("e-mail inválido ou com injeção de cabeçalho não gera link", () => {
    for (const bad of ["", null, undefined, "sem-arroba", "a@b", "a b@c.com", "a@c.com,outra@c.com", "a@c.com?bcc=x@y.com", "a@c.com\nBcc: x@y.com"]) {
      assert.equal(buildMailtoUrl(bad), null, String(bad));
    }
  });

  it("quebra de linha no assunto não injeta cabeçalho", () => {
    const url = buildMailtoUrl("ana@example.com", { subject: "Oi\r\nBcc: x@y.com" });
    assert.ok(url && !url.includes("%0D") && !url.includes("%0A"));
  });

  it("origens conhecidas têm rótulo; o resto cai em CRM", () => {
    assert.equal(sourceLabel("google"), "Google");
    assert.equal(sourceLabel("microsoft"), "Microsoft");
    assert.equal(sourceLabel("outra"), "CRM");
  });
});

describe("funcionalidade contratada", () => {
  it("sem o flag, a funcionalidade fica desligada", () => {
    const base = { features: {} } as never;
    assert.equal(hasFeature(base, "calendar_task_integrations"), false);
    assert.equal(
      hasFeature({ features: { calendar_task_integrations: true } } as never, "calendar_task_integrations"),
      true,
    );
  });
});
