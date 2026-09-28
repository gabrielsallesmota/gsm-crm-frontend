import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  applyColumnPage,
  hasMore,
  initialBoard,
  moveLeadOptimistic,
  reorderIds,
  replaceLead,
  type BoardState,
} from "../src/utils/pipelineBoard.ts";
import { sortStages, type PipelineStage } from "../src/types/pipeline.ts";
import type { Lead } from "../src/types/lead.ts";

function stages(n: number, names?: string[]): PipelineStage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `stage-${i}`,
    label: names?.[i] ?? `Etapa ${i + 1}`,
    color: "#000",
    order: i,
    isWon: i === n - 2,
    isLost: i === n - 1,
  }));
}

function lead(id: string, stageId: string): Lead {
  return {
    id,
    tenantId: "t",
    name: `Lead ${id}`,
    company: "",
    role: "",
    phone: "",
    whatsapp: "",
    phoneNormalized: "",
    email: "",
    city: "",
    state: "",
    notes: "",
    pipelineId: "p",
    stageId,
    ownerId: "u",
    value: 0,
    probability: 0,
    origin: "manual",
    tags: [],
    createdAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    lastInteractionAt: null,
  };
}

function loaded(
  stageList: PipelineStage[],
  perStage: Record<string, Lead[]>,
  totals?: Record<string, number>,
) {
  let board: BoardState = initialBoard(stageList);
  for (const s of stageList) {
    const items = perStage[s.id] ?? [];
    board = applyColumnPage(board, s.id, 1, items, totals?.[s.id] ?? items.length);
  }
  return board;
}

describe("pipeline dinâmico — etapas reais, sem funil fixo", () => {
  for (const n of [2, 5, 7, 10]) {
    it(`quadro com ${n} etapas tem exatamente ${n} colunas, na ordem real`, () => {
      const list = stages(n);
      const board = initialBoard(list);
      assert.deepEqual(
        Object.keys(board),
        list.map((s) => s.id),
      );
    });
  }

  it("nomes arbitrários são só exibição; identidade é o id", () => {
    const list = stages(3, ["Triagem 🔎", "Ganho", "Ganho"]);
    // Duas etapas com o MESMO nome continuam colunas distintas.
    const board = loaded(list, {
      "stage-1": [lead("a", "stage-1")],
      "stage-2": [lead("b", "stage-2")],
    });
    assert.equal(board["stage-1"]?.items[0]?.id, "a");
    assert.equal(board["stage-2"]?.items[0]?.id, "b");
  });

  it("sortStages ordena por `order` (reordenação) sem mutar", () => {
    const list = stages(4);
    const shuffled = [list[2]!, list[0]!, list[3]!, list[1]!];
    assert.deepEqual(
      sortStages(shuffled).map((s) => s.id),
      list.map((s) => s.id),
    );
    assert.equal(shuffled[0]?.id, "stage-2");
  });

  it("reorderIds move a etapa arrastada para a posição do alvo", () => {
    assert.deepEqual(reorderIds(["a", "b", "c", "d"], "d", "b"), ["a", "d", "b", "c"]);
    assert.deepEqual(reorderIds(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
    assert.equal(reorderIds(["a", "b"], "a", "a"), null);
    assert.equal(reorderIds(["a", "b"], "x", "a"), null);
  });
});

describe("mover lead — otimista, com rollback", () => {
  const list = stages(5);

  it("move para outra etapa ajustando os totais reais das duas colunas", () => {
    const board = loaded(
      list,
      { "stage-0": [lead("a", "stage-0"), lead("b", "stage-0")] },
      { "stage-0": 40 },
    );
    const next = moveLeadOptimistic(board, "a", "stage-3");
    assert.deepEqual(
      next["stage-0"]?.items.map((l) => l.id),
      ["b"],
    );
    assert.equal(next["stage-0"]?.total, 39);
    assert.equal(next["stage-3"]?.items[0]?.stageId, "stage-3");
    assert.equal(next["stage-3"]?.total, 1);
  });

  it("mesma etapa ou lead inexistente = sem mudança", () => {
    const board = loaded(list, { "stage-0": [lead("a", "stage-0")] });
    assert.equal(moveLeadOptimistic(board, "a", "stage-0"), board);
    assert.equal(moveLeadOptimistic(board, "zzz", "stage-1"), board);
  });

  it("rollback: devolver a cópia original restaura etapa e totais", () => {
    const original = lead("a", "stage-0");
    const board = loaded(list, { "stage-0": [original] });
    const moved = moveLeadOptimistic(board, "a", "stage-2");
    const rolledBack = replaceLead(moved, original);
    assert.deepEqual(
      rolledBack["stage-0"]?.items.map((l) => l.id),
      ["a"],
    );
    assert.equal(rolledBack["stage-0"]?.total, 1);
    assert.equal(rolledBack["stage-2"]?.items.length, 0);
    assert.equal(rolledBack["stage-2"]?.total, 0);
  });

  it("rollback de um movimento não desfaz outro movimento concorrente", () => {
    const a = lead("a", "stage-0");
    const b = lead("b", "stage-0");
    let board = loaded(list, { "stage-0": [a, b] });
    board = moveLeadOptimistic(board, "a", "stage-1");
    board = moveLeadOptimistic(board, "b", "stage-2");
    board = replaceLead(board, a); // só o de "a" falhou
    assert.deepEqual(
      board["stage-0"]?.items.map((l) => l.id),
      ["a"],
    );
    assert.deepEqual(
      board["stage-2"]?.items.map((l) => l.id),
      ["b"],
    );
  });

  it("resposta do servidor (outra etapa) prevalece sobre a otimista", () => {
    const board = loaded(list, { "stage-0": [lead("a", "stage-0")] });
    const optimistic = moveLeadOptimistic(board, "a", "stage-1");
    const fromServer = { ...lead("a", "stage-3"), name: "Nome atualizado" };
    const final = replaceLead(optimistic, fromServer);
    assert.equal(final["stage-3"]?.items[0]?.name, "Nome atualizado");
    assert.equal(final["stage-1"]?.items.length, 0);
  });
});

describe("paginação por coluna", () => {
  const list = stages(2);

  it("carregar mais acumula sem duplicar e respeita o total real", () => {
    let board = initialBoard(list);
    board = applyColumnPage(board, "stage-0", 1, [lead("a", "stage-0"), lead("b", "stage-0")], 3);
    assert.equal(hasMore(board["stage-0"]!), true);
    // "b" já veio (ex.: um movimento otimista o trouxe) — não duplica.
    board = applyColumnPage(board, "stage-0", 2, [lead("b", "stage-0"), lead("c", "stage-0")], 3);
    assert.deepEqual(
      board["stage-0"]?.items.map((l) => l.id),
      ["a", "b", "c"],
    );
    assert.equal(hasMore(board["stage-0"]!), false);
  });

  it("página 1 substitui (recarga após filtro)", () => {
    let board = initialBoard(list);
    board = applyColumnPage(board, "stage-0", 1, [lead("a", "stage-0")], 1);
    board = applyColumnPage(board, "stage-0", 1, [lead("z", "stage-0")], 1);
    assert.deepEqual(
      board["stage-0"]?.items.map((l) => l.id),
      ["z"],
    );
  });
});
