// FASE 1B — motor da importação em lotes (D-10). Node puro: validação, lotes, retentativas com a
// MESMA chave de idempotência, retomada, cancelamento e relatório por linha.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../src/types/common.ts";
import type { ImportRowInput, ImportSummary } from "../src/types/lead.ts";
import {
  BATCH_SIZE,
  MAX_ATTEMPTS,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  buildReport,
  checkLimits,
  chunk,
  csvSafeCell,
  finalState,
  importKey,
  isRetryable,
  prepareRows,
  reportToCsv,
  runImport,
  signatureOf,
  type PreparedRow,
  type Progress,
} from "../src/utils/leadImport.ts";

const ORIGINS = ["whatsapp", "instagram"];
const noSleep = () => Promise.resolve();

function rowsOf(n: number): PreparedRow[] {
  return Array.from({ length: n }, (_, i) => ({ rowNumber: i + 2, input: { name: `Lead ${i}` } }));
}

function createdAll(rows: ImportRowInput[]): ImportSummary {
  return {
    total: rows.length,
    created: rows.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    rows: rows.map((r, i) => ({ rowIndex: i, outcome: "created", name: r.name, detail: null })),
  };
}

describe("prepareRows — validação antes do envio", () => {
  const headers = ["Nome", "UF", "Origem", "Telefone"];
  const mapping = ["name", "state", "origin", "phone"];

  it("separa válidas e inválidas SEM perder o número da linha original (cabeçalho = 1)", () => {
    const out = prepareRows(
      headers,
      mapping,
      [
        ["Ana", "SP", "whatsapp", "11999990000"],
        ["", "SP", "", ""],
        ["Bia", "SAO", "", ""],
        ["C".repeat(201), "", "", ""],
      ],
      ORIGINS,
    );
    assert.equal(out.totalRows, 4);
    assert.deepEqual(out.valid.map((r) => r.rowNumber), [2]);
    assert.deepEqual(out.invalid.map((r) => r.rowNumber), [3, 4, 5]);
    assert.match(out.invalid[0]!.detail, /Nome é obrigatório/);
    assert.match(out.invalid[1]!.detail, /UF/);
    assert.match(out.invalid[2]!.detail, /200/);
  });

  it("origem desconhecida: o lead segue sem origem e vira AVISO (não é descartado em silêncio)", () => {
    const out = prepareRows(headers, mapping, [["Ana", "", "Indicação", ""]], ORIGINS);
    assert.deepEqual(out.valid[0]!.input, { name: "Ana" });
    assert.equal(out.warnings.unknownOrigin, 1);
  });

  it("telefone com menos de 10 dígitos vira aviso; vazio ou longo não", () => {
    const out = prepareRows(
      headers,
      mapping,
      [
        ["A", "", "", "123"],
        ["B", "", "", "(11) 99999-0000"],
        ["C", "", "", ""],
      ],
      ORIGINS,
    );
    assert.equal(out.warnings.shortPhone, 1);
    assert.equal(out.valid.length, 3);
  });

  it("sem coluna de Nome: nameMapped=false e todas as linhas inválidas", () => {
    const out = prepareRows(["Fone"], ["phone"], [["11999990000"]], ORIGINS);
    assert.equal(out.nameMapped, false);
    assert.equal(out.valid.length, 0);
    assert.equal(out.invalid.length, 1);
  });
});

describe("limites e lotes", () => {
  it("chunk: lotes de até 500, ordem preservada, nada perdido", () => {
    for (const n of [0, 1, 499, 500, 501, 2000, 2001, 10000]) {
      const items = rowsOf(n);
      const parts = chunk(items);
      assert.equal(parts.length, Math.ceil(n / BATCH_SIZE));
      assert.ok(parts.every((p) => p.length <= BATCH_SIZE));
      assert.deepEqual(parts.flat(), items);
    }
  });

  it("checkLimits: 10.000 linhas e 5 MB passam; acima disso são recusados com mensagem", () => {
    assert.equal(checkLimits(1000, MAX_IMPORT_ROWS), null);
    assert.equal(checkLimits(MAX_FILE_BYTES, 1), null);
    assert.match(checkLimits(1000, MAX_IMPORT_ROWS + 1)!, /Nada foi importado/);
    assert.match(checkLimits(MAX_FILE_BYTES + 1, 1)!, /5 MB/);
  });

  it("importKey é estável, única por lote e cabe no limite do servidor (≤128)", () => {
    assert.equal(importKey("abc", 3), "imp-abc-0003");
    assert.notEqual(importKey("abc", 1), importKey("abc", 2));
    assert.ok(importKey("a".repeat(32), 19).length <= 128);
  });

  it("signatureOf: mesma entrada = mesma assinatura; qualquer mudança = outra", () => {
    assert.equal(signatureOf(["a", "b"]), signatureOf(["a", "b"]));
    assert.notEqual(signatureOf(["a", "b"]), signatureOf(["a", "c"]));
    assert.notEqual(signatureOf(["ab", "c"]), signatureOf(["a", "bc"]));
  });
});

describe("isRetryable", () => {
  it("rede, timeout, 409, 429 e 5xx repetem; 4xx de regra não", () => {
    for (const s of [0, 408, 409, 429, 500, 502, 503]) assert.equal(isRetryable(new ApiError(s, "x")), true, String(s));
    for (const s of [400, 401, 403, 404, 422]) assert.equal(isRetryable(new ApiError(s, "x")), false, String(s));
    assert.equal(isRetryable(new TypeError("Failed to fetch")), true);
  });
});

describe("runImport", () => {
  it("envia os lotes em ordem, um por vez, cada um com a sua chave", async () => {
    const batches = chunk(rowsOf(1200));
    const calls: { size: number; key: string }[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const out = await runImport({
      batches,
      importId: "id1",
      send: async (rows, key) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        calls.push({ size: rows.length, key });
        await Promise.resolve();
        inFlight -= 1;
        return createdAll(rows);
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(out.state, "completed");
    assert.equal(maxInFlight, 1);
    assert.deepEqual(calls.map((c) => c.size), [500, 500, 200]);
    assert.deepEqual(calls.map((c) => c.key), ["imp-id1-0000", "imp-id1-0001", "imp-id1-0002"]);
  });

  it("progresso real: processadas e criadas acumulam lote a lote", async () => {
    const batches = chunk(rowsOf(700));
    const seen: Progress[] = [];
    await runImport({
      batches,
      importId: "p",
      send: async (rows) => createdAll(rows),
      onProgress: (p) => seen.push(p),
      isCancelled: () => false,
      sleep: noSleep,
    });
    const last = seen.at(-1)!;
    assert.equal(last.state, "completed");
    assert.equal(last.processed, 700);
    assert.equal(last.created, 700);
    assert.equal(last.batchesDone, 2);
    assert.ok(seen.some((p) => p.currentBatch === 1) && seen.some((p) => p.currentBatch === 2));
    const processed = seen.map((p) => p.processed);
    assert.deepEqual(processed, [...processed].sort((a, b) => a - b)); // nunca regride
  });

  it("falha transitória: repete o MESMO lote com a MESMA chave até funcionar", async () => {
    const keys: string[] = [];
    let n = 0;
    const out = await runImport({
      batches: chunk(rowsOf(3)),
      importId: "r",
      send: async (rows, key) => {
        keys.push(key);
        n += 1;
        if (n < MAX_ATTEMPTS) throw new ApiError(503, "indisponível");
        return createdAll(rows);
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(out.state, "completed");
    assert.equal(keys.length, MAX_ATTEMPTS);
    assert.equal(new Set(keys).size, 1);
  });

  it("falha persistente: para no lote, não envia os seguintes e guarda o erro", async () => {
    const sent: string[] = [];
    const out = await runImport({
      batches: chunk(rowsOf(1200)),
      importId: "f",
      send: async (rows, key) => {
        sent.push(key);
        if (key.endsWith("0001")) throw new ApiError(500, "boom");
        return createdAll(rows);
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(out.state, "failed");
    assert.equal(out.failure?.batchIndex, 1);
    assert.equal(out.results.size, 1);
    assert.equal(sent.filter((k) => k.endsWith("0002")).length, 0);
    assert.equal(sent.filter((k) => k.endsWith("0001")).length, MAX_ATTEMPTS);
  });

  it("erro de regra (422/403) não é repetido", async () => {
    let calls = 0;
    const out = await runImport({
      batches: chunk(rowsOf(2)),
      importId: "x",
      send: async () => {
        calls += 1;
        throw new ApiError(422, "recusado");
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(calls, 1);
    assert.equal(out.state, "failed");
  });

  it("retomar: lotes já concluídos NÃO são reenviados", async () => {
    const batches = chunk(rowsOf(1000));
    const first = await runImport({
      batches,
      importId: "z",
      send: async (rows, key) => {
        if (key.endsWith("0001")) throw new ApiError(403, "x");
        return createdAll(rows);
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(first.state, "failed");
    const keys: string[] = [];
    const second = await runImport({
      batches,
      importId: "z",
      done: first.results,
      send: async (rows, key) => {
        keys.push(key);
        return createdAll(rows);
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.deepEqual(keys, ["imp-z-0001"]);
    assert.equal(second.state, "completed");
    assert.equal(second.results.size, 2);
  });

  it("cancelar: termina o lote em andamento e não envia os seguintes", async () => {
    let cancelled = false;
    const keys: string[] = [];
    const out = await runImport({
      batches: chunk(rowsOf(1500)),
      importId: "c",
      send: async (rows, key) => {
        keys.push(key);
        cancelled = true; // o usuário clica durante o lote 1
        return createdAll(rows);
      },
      onProgress: () => undefined,
      isCancelled: () => cancelled,
      sleep: noSleep,
    });
    assert.equal(out.state, "cancelled");
    assert.deepEqual(keys, ["imp-c-0000"]);
    assert.equal(out.results.size, 1);
  });
});

describe("relatório", () => {
  it("combina inválidas, resultados do servidor (com o número ORIGINAL) e lotes não processados", async () => {
    const prepared = prepareRows(
      ["Nome", "Telefone"],
      ["name", "phone"],
      [["Ana", "1"], ["", "2"], ["Bia", "3"], ["Caio", "4"]],
      ORIGINS,
    );
    const batches = chunk(prepared.valid, 2); // [Ana(2), Bia(4)] e [Caio(5)]
    const out = await runImport({
      batches,
      importId: "rep",
      send: async (rows, key) => {
        if (key.endsWith("0001")) throw new ApiError(403, "Sem permissão");
        return {
          total: 2,
          created: 1,
          updated: 0,
          skipped: 1,
          errors: 0,
          rows: [
            { rowIndex: 0, outcome: "created", name: rows[0]!.name, detail: null },
            { rowIndex: 1, outcome: "skipped", name: rows[1]!.name, detail: "Telefone já cadastrado", reason: "duplicate" },
          ],
        };
      },
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    const report = buildReport(prepared, batches, out);
    assert.deepEqual(report.rows.map((r) => [r.rowNumber, r.kind]), [
      [2, "created"],
      [3, "validation"],
      [4, "duplicate"],
      [5, "processing"],
    ]);
    assert.equal(report.counts.created, 1);
    assert.equal(finalState(out, report), "failed");
  });

  it("estado final: 'Concluído' só sem pendências; 'Concluído com erros' com rejeições", async () => {
    const prepared = prepareRows(["Nome"], ["name"], [["Ana"], [""]], ORIGINS);
    const batches = chunk(prepared.valid);
    const out = await runImport({
      batches,
      importId: "s",
      send: async (rows) => createdAll(rows),
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(finalState(out, buildReport(prepared, batches, out)), "completed_with_errors");
    const clean = prepareRows(["Nome"], ["name"], [["Ana"]], ORIGINS);
    const cleanBatches = chunk(clean.valid);
    const out2 = await runImport({
      batches: cleanBatches,
      importId: "s2",
      send: async (rows) => createdAll(rows),
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    assert.equal(finalState(out2, buildReport(clean, cleanBatches, out2)), "completed");
  });

  it("duplicado ignorado e sem permissão são categorias distintas pelo `reason`", async () => {
    const prepared = prepareRows(["Nome"], ["name"], [["A"], ["B"]], ORIGINS);
    const batches = chunk(prepared.valid);
    const out = await runImport({
      batches,
      importId: "k",
      send: async () => ({
        total: 2,
        created: 0,
        updated: 0,
        skipped: 2,
        errors: 0,
        rows: [
          { rowIndex: 0, outcome: "skipped", name: "A", detail: "d", reason: "duplicate" },
          { rowIndex: 1, outcome: "skipped", name: "B", detail: "p", reason: "permission" },
        ],
      }),
      onProgress: () => undefined,
      isCancelled: () => false,
      sleep: noSleep,
    });
    const report = buildReport(prepared, batches, out);
    assert.equal(report.counts.duplicate, 1);
    assert.equal(report.counts.permission, 1);
  });
});

describe("CSV do relatório", () => {
  it("neutraliza fórmulas (=, +, -, @, tab) e escapa aspas/vírgulas", () => {
    for (const bad of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\tx"]) assert.equal(csvSafeCell(bad), `'${bad}`);
    assert.equal(csvSafeCell("Ana"), "Ana");
    const csv = reportToCsv({
      rows: [
        { rowNumber: 2, name: "=HYPERLINK(\"http://x\")", kind: "validation", detail: "a, b" },
        { rowNumber: 3, name: "Ok", kind: "created", detail: null },
      ],
      counts: { created: 1, updated: 0, duplicate: 0, permission: 0, validation: 1, processing: 0, unprocessed: 0 },
    });
    assert.ok(csv.startsWith("﻿Linha,Nome,Resultado,Motivo"));
    assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`));
    assert.ok(csv.includes('"a, b"'));
    assert.ok(!csv.includes("Ok")); // sucesso não entra no relatório de atenção
  });
});
