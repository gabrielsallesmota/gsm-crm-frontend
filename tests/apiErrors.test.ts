import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { describeError, readableDetail } from "../src/utils/apiErrors.ts";
import { ApiError } from "../src/types/common.ts";

describe("describeError — mensagem de usuário por status HTTP", () => {
  it("400/409/422 usam a regra de negócio do backend", () => {
    assert.equal(
      describeError(new ApiError(409, "E-mail já cadastrado"), "x"),
      "E-mail já cadastrado",
    );
    assert.equal(describeError(new ApiError(422, "Etapa inválida"), "x"), "Etapa inválida");
    assert.equal(describeError(new ApiError(400, "Arquivo inválido"), "x"), "Arquivo inválido");
  });
  it("401 mostra o motivo (ex.: senha atual incorreta)", () => {
    assert.equal(
      describeError(new ApiError(401, "Senha atual incorreta"), "x"),
      "Senha atual incorreta",
    );
    assert.match(describeError(new ApiError(401, ""), "x"), /sessão expirou/);
  });
  it("403 mostra o motivo ou 'sem permissão'", () => {
    assert.equal(
      describeError(new ApiError(403, "Organização suspensa"), "x"),
      "Organização suspensa",
    );
    assert.match(describeError(new ApiError(403, ""), "x"), /permissão/);
  });
  it("404 nunca expõe o id técnico", () => {
    const msg = describeError(new ApiError(404, "Lead 3f2a-... not found"), "x");
    assert.doesNotMatch(msg, /3f2a/);
    assert.match(msg, /não encontrado/);
  });
  it("429, 500, 503 e rede viram mensagens amigáveis", () => {
    assert.match(describeError(new ApiError(429, "Too Many Requests"), "x"), /Aguarde/);
    assert.match(describeError(new ApiError(500, "IntegrityError ..."), "x"), /Erro inesperado/);
    assert.doesNotMatch(describeError(new ApiError(500, "IntegrityError ..."), "x"), /Integrity/);
    assert.match(describeError(new ApiError(503, "down"), "x"), /indisponível/);
    assert.match(describeError(new ApiError(0, ""), "x"), /conectar/);
  });
  it("erro desconhecido usa o fallback da ação", () => {
    assert.equal(describeError("boom", "Não foi possível salvar"), "Não foi possível salvar");
  });
});

describe("readableDetail — corpo de erro do FastAPI", () => {
  it("string passa direto", () => {
    assert.equal(readableDetail("Regra X", "fb"), "Regra X");
  });
  it("lista de validação (422) vira uma frase com o campo traduzido", () => {
    const detail = [{ loc: ["body", "due_at"], msg: "Input should have timezone info", type: "x" }];
    // Etapa 4: a mensagem do Pydantic (inglês) também é traduzida.
    assert.equal(readableDetail(detail, "fb"), "Vencimento: data/hora inválida");
  });
  it("formato inesperado → fallback", () => {
    assert.equal(readableDetail({ weird: true }, "fb"), "fb");
    assert.equal(readableDetail([], "fb"), "fb");
  });
});

describe("campos acima do limite (422 do Pydantic) viram frase legível, não erro 500", () => {
  const detail = (field: string, max: number) => [
    { type: "string_too_long", loc: ["body", field], msg: `String should have at most ${max} characters` },
  ];
  const cases: [string, number, string][] = [
    ["company", 200, "Empresa: pode ter no máximo 200 caracteres"],
    ["position", 120, "Cargo: pode ter no máximo 120 caracteres"],
    ["phone", 30, "Telefone: pode ter no máximo 30 caracteres"],
    ["whatsapp", 30, "WhatsApp: pode ter no máximo 30 caracteres"],
    ["email", 255, "E-mail: pode ter no máximo 255 caracteres"],
    ["city", 120, "Cidade: pode ter no máximo 120 caracteres"],
    ["notes", 4000, "Observações: pode ter no máximo 4000 caracteres"],
  ];
  for (const [field, max, expected] of cases) {
    it(field, () => {
      assert.equal(readableDetail(detail(field, max), "fb"), expected);
    });
  }

  it("422 de domínio (telefone com dígitos demais) é mostrado como veio", () => {
    assert.equal(
      describeError(new ApiError(422, "Telefone com dígitos demais; confira o número."), "fb"),
      "Telefone com dígitos demais; confira o número.",
    );
  });

  it("nenhum 422 é apresentado como 'erro inesperado do servidor'", () => {
    assert.doesNotMatch(describeError(new ApiError(422, "Empresa: pode ter no máximo 200 caracteres"), "fb"), /inesperado/i);
  });
});

