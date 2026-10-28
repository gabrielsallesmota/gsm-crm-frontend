import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  canRetry,
  describeSendError,
  describeWhatsapp,
  mergeMessages,
  messageStatusInfo,
  newClientRequestId,
  shortWhen,
  shouldPollQr,
  validateReply,
  windowHint,
  type ChatMessage,
  type WhatsappConnection,
} from "../src/utils/messaging.ts";
import { navSections } from "../src/layouts/navigation.ts";
import type { AuthUser } from "../src/types/auth.ts";

function conn(status: WhatsappConnection["status"]): WhatsappConnection {
  return { status, phone: null, displayName: null, lastConnectedAt: null, error: null };
}

function msg(id: string, at: string, over: Partial<ChatMessage> = {}): ChatMessage {
  return { id, at, direction: "in", type: "text", body: id, status: "received", sentBy: null, error: null, ...over };
}

describe("conexão do WhatsApp", () => {
  it("descreve cada situação em uma frase", () => {
    assert.equal(describeWhatsapp(null).label, "Não conectado");
    assert.equal(describeWhatsapp(conn("connected")).tone, "ok");
    assert.equal(describeWhatsapp(conn("qr_pending")).tone, "warn");
    assert.equal(describeWhatsapp(conn("disconnected")).tone, "bad");
    assert.equal(describeWhatsapp(conn("error")).label, "Erro na conexão");
  });

  it("só consulta o status enquanto o QR está na tela e ainda não conectou", () => {
    assert.equal(shouldPollQr(conn("qr_pending"), true), true);
    assert.equal(shouldPollQr(conn("qr_pending"), false), false);
    assert.equal(shouldPollQr(conn("connected"), true), false);
    assert.equal(shouldPollQr(null, true), false);
  });
});

describe("mensagens", () => {
  it("só oferece reenviar o que falhou ou ficou sem confirmação", () => {
    assert.equal(canRetry("failed"), true);
    assert.equal(canRetry("uncertain"), true);
    for (const s of ["queued", "sending", "sent", "delivered", "read", "received"] as const) {
      assert.equal(canRetry(s), false);
    }
    assert.equal(messageStatusInfo("read").label, "Lida");
    assert.equal(messageStatusInfo("uncertain").tone, "warn");
  });

  it("explica o erro do envio sem jargão", () => {
    assert.equal(describeSendError(null), null);
    assert.match(describeSendError("window_closed") ?? "", /24 h/);
    assert.match(describeSendError("evolution_timeout") ?? "", /confira no celular/);
    assert.match(describeSendError("whatsapp_disconnected") ?? "", /desconectado/);
    // correção da auditoria: envio interrompido, canal desligado e credencial recusada
    assert.match(describeSendError("send_interrupted") ?? "", /confira no celular/);
    assert.match(describeSendError("channel_disabled") ?? "", /desligado/);
    assert.match(describeSendError("evolution_401") ?? "", /reconectar/);
    assert.match(describeSendError("meta_190") ?? "", /reconectar/);
  });

  it("valida o texto conforme o canal", () => {
    assert.equal(validateReply("whatsapp_evolution", "   "), "Escreva a mensagem.");
    assert.equal(validateReply("whatsapp_evolution", "Oi"), null);
    assert.ok(validateReply("whatsapp_evolution", "x".repeat(4097)));
    // Instagram conta BYTES: 334 emojis (4 bytes cada) passam de 1000
    assert.ok(validateReply("instagram", "😀".repeat(334)));
    assert.equal(validateReply("instagram", "a".repeat(1000)), null);
  });

  it("gera um id de envio novo por mensagem", () => {
    const a = newClientRequestId();
    const b = newClientRequestId();
    assert.notEqual(a, b);
    assert.ok(a.length >= 8 && a.length <= 80);
  });

  it("junta mensagens sem duplicar e em ordem de horário", () => {
    const current = [msg("a", "2026-10-27T10:00:00Z"), msg("b", "2026-10-27T10:01:00Z")];
    const merged = mergeMessages(current, [
      msg("b", "2026-10-27T10:01:00Z", { status: "read" }),
      msg("c", "2026-10-27T10:00:30Z"),
    ]);
    assert.deepEqual(
      merged.map((m) => m.id),
      ["a", "c", "b"],
    );
    assert.equal(merged.at(-1)?.status, "read");
  });

  it("horário curto e aviso da janela do Instagram", () => {
    const now = new Date("2026-10-27T15:00:00Z");
    assert.equal(shortWhen(null, now), "");
    assert.equal(shortWhen("2026-10-27T14:59:40Z", now), "agora");
    assert.equal(shortWhen("2026-10-27T14:50:00Z", now), "10 min");
    assert.equal(windowHint("2026-10-27T18:30:00Z", now), "Janela do Instagram fecha em 3 h");
    assert.equal(windowHint("2026-10-27T15:20:00Z", now), "Janela do Instagram fecha em 20 min");
    assert.equal(windowHint("2026-10-27T14:00:00Z", now), null);
  });
});

describe("menu Conversas", () => {
  const base = {
    id: "u1",
    name: "Ana",
    email: "a@x.com",
    role: "vendedor",
    isPlatformStaff: false,
  } as unknown as AuthUser;

  function labels(features: Record<string, boolean>): string[] {
    const user = { ...base, features } as unknown as AuthUser;
    return navSections(user).flatMap((s) => s.items.map((i) => i.label));
  }

  it("aparece com WhatsApp OU Instagram contratado", () => {
    assert.ok(!labels({ crm: true }).includes("Conversas"));
    assert.ok(labels({ crm: true, whatsapp: true }).includes("Conversas"));
    assert.ok(labels({ crm: true, instagram: true }).includes("Conversas"));
  });
});
