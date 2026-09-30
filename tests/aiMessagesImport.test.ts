import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseAiMessages } from "../src/utils/aiMessagesImport.ts";

function ok(raw: string) {
  const result = parseAiMessages(raw);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  return result.ok ? result.value : { opportunity: "", messages: [] };
}

function error(raw: string): string {
  const result = parseAiMessages(raw);
  assert.equal(result.ok, false);
  return result.ok ? "" : result.error;
}

describe("parseAiMessages", () => {
  it("lê o formato pedido no prompt", () => {
    const value = ok(
      '{"oportunidade": "Agendamento pelo WhatsApp", "mensagens": ["Oi", "Tudo bem?", "Prévia", "Tchau"]}',
    );
    assert.equal(value.opportunity, "Agendamento pelo WhatsApp");
    assert.deepEqual(value.messages, ["Oi", "Tudo bem?", "Prévia", "Tchau"]);
  });

  it("ignora cercas de código e texto em volta", () => {
    const value = ok('Claro! Aqui está:\n```json\n{"mensagens": [" A ", "B"]}\n```\nBoa sorte!');
    assert.deepEqual(value.messages, ["A", "B"]);
    assert.equal(value.opportunity, "");
  });

  it("aceita array puro, objetos com texto e chaves numeradas", () => {
    assert.deepEqual(ok('["1", "2", "3"]').messages, ["1", "2", "3"]);
    assert.deepEqual(ok('{"messages": [{"texto": "X"}, {"text": "Y"}]}').messages, ["X", "Y"]);
    assert.deepEqual(ok('{"mensagem_1": "P", "mensagem_2": "Q"}').messages, ["P", "Q"]);
  });

  it("recusa respostas que não dá pra importar", () => {
    assert.match(error("   "), /Cole a resposta/);
    assert.match(error("sem json aqui"), /Não encontrei um JSON/);
    assert.match(error('{"mensagens": ["a",]}'), /inválido/);
    assert.match(error('{"outra": 1}'), /"mensagens"/);
    assert.match(error('{"mensagens": ["", "  "]}'), /nenhuma mensagem/);
    assert.match(error('{"mensagens": ["1","2","3","4","5"]}'), /máximo é 4/);
    assert.match(error('{"mensagens": [1, 2]}'), /precisam ser texto/);
    assert.match(error(JSON.stringify({ mensagens: ["ok", "x".repeat(2001)] })), /mensagem 2 passa/);
  });
});
