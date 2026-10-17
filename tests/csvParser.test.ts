// FASE 0 — caracterização do leitor de CSV usado pelas importações (F-10). Node puro (sem DOM).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv, readFileAsText } from "../src/utils/csv.ts";

describe("parseCsv — separadores", () => {
  it("vírgula", () => {
    const out = parseCsv("Nome,Telefone\nAna,11999990000\nBia,11988880000");
    assert.deepEqual(out.headers, ["Nome", "Telefone"]);
    assert.deepEqual(out.rows, [
      ["Ana", "11999990000"],
      ["Bia", "11988880000"],
    ]);
  });

  it("ponto e vírgula (Excel em português) é detectado pela primeira linha", () => {
    const out = parseCsv("Nome;Cidade\nAna;São Paulo");
    assert.deepEqual(out.headers, ["Nome", "Cidade"]);
    assert.deepEqual(out.rows, [["Ana", "São Paulo"]]);
  });

  it("empate de separadores na primeira linha usa vírgula", () => {
    assert.deepEqual(parseCsv("a,b;c\n1,2;3").headers, ["a", "b;c"]);
  });

  it("detecção olha só a PRIMEIRA linha: dados com ';' num arquivo com vírgula não quebram colunas", () => {
    const out = parseCsv('Nome,Obs\nAna,"fez; refez"');
    assert.deepEqual(out.rows, [["Ana", "fez; refez"]]);
  });
});

describe("parseCsv — aspas e escapes (RFC 4180)", () => {
  it("campo entre aspas com vírgula e quebra de linha", () => {
    const out = parseCsv('Nome,Obs\nAna,"linha 1\nlinha 2, com vírgula"');
    assert.deepEqual(out.rows, [["Ana", "linha 1\nlinha 2, com vírgula"]]);
  });

  it('aspas duplas escapadas ("")', () => {
    assert.deepEqual(parseCsv('a,b\n1,"ele disse ""oi"""').rows, [["1", 'ele disse "oi"']]);
  });

  it("aspas sem fechar consomem o restante do arquivo (comportamento atual, sem erro)", () => {
    const out = parseCsv('a,b\n1,"sem fim\n2,3');
    assert.equal(out.rows.length, 1);
    assert.equal(out.rows[0]?.[0], "1");
  });
});

describe("parseCsv — formato do arquivo", () => {
  it("remove o BOM do UTF-8 do primeiro cabeçalho", () => {
    assert.deepEqual(parseCsv("﻿Nome,Cidade\nAna,SP").headers, ["Nome", "Cidade"]);
  });

  it("aceita CRLF e CR", () => {
    assert.deepEqual(parseCsv("a,b\r\n1,2\r\n3,4").rows, [
      ["1", "2"],
      ["3", "4"],
    ]);
    assert.equal(parseCsv("a,b\r1,2").rows.length, 1);
  });

  it("descarta linhas totalmente em branco e apara os cabeçalhos", () => {
    const out = parseCsv(" Nome , Telefone \n\n  ,  \nAna,1\n\n");
    assert.deepEqual(out.headers, ["Nome", "Telefone"]);
    assert.deepEqual(out.rows, [["Ana", "1"]]);
  });

  it("arquivo vazio: sem cabeçalhos nem linhas", () => {
    assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  });

  it("só cabeçalho: nenhuma linha de dados", () => {
    const out = parseCsv("Nome,Telefone");
    assert.deepEqual(out.headers, ["Nome", "Telefone"]);
    assert.deepEqual(out.rows, []);
  });

  it("linhas com menos colunas que o cabeçalho são mantidas como estão (sem preencher)", () => {
    assert.deepEqual(parseCsv("a,b,c\n1,2").rows, [["1", "2"]]);
  });

  it("colunas desconhecidas e acentos/emoji passam intactos", () => {
    const out = parseCsv("Coluna Estranha,Nome\n✓ ok,José");
    assert.deepEqual(out.rows, [["✓ ok", "José"]]);
  });

  it("não valida telefone nem campos obrigatórios: isso é feito no mapeamento e no servidor", () => {
    assert.deepEqual(parseCsv("Nome,Telefone\n,abc").rows, [["", "abc"]]);
  });
});

describe("readFileAsText — codificação", () => {
  const file = (bytes: number[]) => new File([new Uint8Array(bytes)], "x.csv");

  it("UTF-8 válido (com acentos) é lido como está", async () => {
    const bytes = [...new TextEncoder().encode("Crânio;José")];
    assert.equal(await readFileAsText(file(bytes)), "Crânio;José");
  });

  it("UTF-8 com BOM: o BOM é removido pelo decodificador", async () => {
    const bytes = [0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Nome")];
    assert.equal(await readFileAsText(file(bytes)), "Nome");
  });

  it("Windows-1252 (Excel 'CSV' padrão): byte 0xE2 vira 'â' e não o caractere de substituição", async () => {
    // "Crânio" em ANSI
    const text = await readFileAsText(file([0x43, 0x72, 0xe2, 0x6e, 0x69, 0x6f]));
    assert.equal(text, "Crânio");
    assert.ok(!text.includes("�"));
  });

  it("bytes arbitrários nunca lançam erro (caem em Windows-1252)", async () => {
    await assert.doesNotReject(readFileAsText(file([0xff, 0xfe, 0x00, 0x80])));
  });
});
