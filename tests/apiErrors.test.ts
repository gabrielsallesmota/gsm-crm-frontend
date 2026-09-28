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
    assert.equal(readableDetail(detail, "fb"), "Vencimento: Input should have timezone info");
  });
  it("formato inesperado → fallback", () => {
    assert.equal(readableDetail({ weird: true }, "fb"), "fb");
    assert.equal(readableDetail([], "fb"), "fb");
  });
});
