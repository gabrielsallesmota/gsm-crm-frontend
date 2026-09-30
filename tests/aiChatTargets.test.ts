import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { aiChatUrl } from "../src/utils/aiChatTargets.ts";

describe("aiChatUrl", () => {
  it("preenche o prompt na URL do ChatGPT e do Claude", () => {
    assert.equal(aiChatUrl("chatgpt", "Olá & tchau"), "https://chatgpt.com/?q=Ol%C3%A1%20%26%20tchau");
    assert.equal(aiChatUrl("claude", "oi"), "https://claude.ai/new?q=oi");
  });

  it("Manus e prompts longos abrem só o site (o prompt já está copiado)", () => {
    assert.equal(aiChatUrl("manus", "oi"), "https://manus.im/app");
    assert.equal(aiChatUrl("chatgpt", "x".repeat(8000)), "https://chatgpt.com/");
  });
});
