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
  it("lê a cadência em etapas e põe os desvios no roteiro das ligações", () => {
    const value = ok(
      JSON.stringify({
        oportunidade: "Agendamento online",
        etapas: [
          { dia: 1, canal: "whatsapp", mensagem: "Oi!", se_responder: "mandar a ideia" },
          {
            dia: 2,
            canal: "ligacao",
            mensagem: "Roteiro D2",
            se_responder: "aprofundar",
            se_nao_responder: "seguir para o D4",
          },
          { dia: 4, canal: "whatsapp", mensagem: "Valor" },
          { dia: 7, canal: "ligação", roteiro: "Roteiro D7" },
          { dia: 10, canal: "whatsapp", mensagem: "Última" },
        ],
        base_da_estrategia: "hipótese",
      }),
    );
    assert.equal(value.opportunity, "Agendamento online");
    assert.equal(value.messages.length, 5);
    assert.equal(value.messages[0], "Oi!"); // WhatsApp: vai como está
    assert.equal(
      value.messages[1],
      "Roteiro D2\n\n→ Se responder: aprofundar\n→ Se não responder: seguir para o D4",
    );
    assert.equal(value.messages[3], "Roteiro D7");
  });

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
    assert.match(error('{"outra": 1}'), /"etapas"/);
    assert.match(error('{"mensagens": ["", "  "]}'), /nenhuma mensagem/);
    assert.match(error('{"mensagens": ["1","2","3","4","5","6"]}'), /máximo é 5/);
    assert.match(error('{"mensagens": [1, 2]}'), /precisam ser texto/);
    assert.match(error(JSON.stringify({ mensagens: ["ok", "x".repeat(2001)] })), /mensagem 2 passa/);
  });
});
