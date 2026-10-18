// Prompt 06 — regras de apresentação do quadro: nada de total calculado sobre página parcial.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Lead } from "../src/types/lead.ts";
import type { PipelineStage } from "../src/types/pipeline.ts";
import { last7DaysPeriod, todayPeriod } from "../src/utils/periods.ts";
import type { BoardColumn, BoardState } from "../src/utils/pipelineBoard.ts";
import { boardSummary, columnValue, describePeriod, filterChips, leadAge } from "../src/utils/pipelineView.ts";

const lead = (value: number): Lead => ({ value }) as Lead;
const column = (items: Lead[], total: number, extra: Partial<BoardColumn> = {}): BoardColumn => ({
  items,
  total,
  page: 1,
  loading: false,
  error: null,
  ...extra,
});
const stage = (id: string, extra: Partial<PipelineStage> = {}): PipelineStage =>
  ({ id, label: id, color: "#000", order: 0, isWon: false, isLost: false, ...extra }) as PipelineStage;

describe("leadAge — idade desde a CRIAÇÃO", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  it("hoje / dias / semanas / meses / anos", () => {
    assert.equal(leadAge(at(0), now).short, "hoje");
    assert.equal(leadAge(at(1), now).long, "Criado há 1 dia");
    assert.equal(leadAge(at(3), now).short, "3 d");
    assert.equal(leadAge(at(14), now).short, "2 sem");
    assert.equal(leadAge(at(65), now).long, "Criado há 2 meses");
    assert.equal(leadAge(at(800), now).short, "2 a");
  });
  it("data inválida não quebra nem inventa texto", () => {
    assert.deepEqual(leadAge("lixo", now), { short: "", long: "", title: "" });
  });
  it("relógio atrasado (criado no futuro) vira 'hoje', nunca negativo", () => {
    assert.equal(leadAge(at(-3), now).short, "hoje");
  });
});

describe("describePeriod — sempre sobre a data de criação", () => {
  it("sem filtro = null; presets reconhecidos; intervalo e limites abertos", () => {
    assert.equal(describePeriod({}), null);
    assert.equal(describePeriod(todayPeriod()), "Hoje");
    assert.equal(describePeriod(last7DaysPeriod()), "7 dias");
    assert.equal(describePeriod({ dateFrom: "2026-01-05", dateTo: "2026-02-10" }), "05/01 – 10/02");
    assert.equal(describePeriod({ dateFrom: "2026-01-05" }), "desde 05/01");
    assert.equal(describePeriod({ dateTo: "2026-02-10" }), "até 10/02");
  });
});

describe("filterChips", () => {
  it("só lista o que está ativo, com o grupo 'Criados em' para o período", () => {
    assert.deepEqual(filterChips({ search: "", ownerLabel: null, period: {}, sortLabel: null }), []);
    const chips = filterChips({ search: "maria", ownerLabel: "Ana", period: todayPeriod(), sortLabel: "Nome A-Z" });
    assert.deepEqual(
      chips.map((c) => `${c.group}: ${c.value}`),
      ["Busca: maria", "Responsável: Ana", "Criados em: Hoje", "Ordem: Nome A-Z"],
    );
  });
});

describe("columnValue — soma só de coluna INTEIRA", () => {
  it("coluna completa soma; parcial, carregando, com erro ou sem página = null", () => {
    assert.equal(columnValue(column([lead(100), lead(50)], 2)), 150);
    assert.equal(columnValue(column([lead(100)], 2)), null); // há mais no servidor
    assert.equal(columnValue(column([lead(100), lead(50)], 2, { loading: true })), null);
    assert.equal(columnValue(column([], 0, { error: "x" })), null);
    assert.equal(columnValue(column([], 0, { page: 0 })), null);
    assert.equal(columnValue(undefined), null);
  });
  it("coluna vazia e inteira vale 0 (não 'indisponível')", () => {
    assert.equal(columnValue(column([], 0)), 0);
  });
});

describe("boardSummary", () => {
  const stages = [stage("novo"), stage("contato"), stage("ganho", { isWon: true }), stage("perdido", { isLost: true })];
  it("antes da 1ª página de todas as colunas: não está pronto (nada de total parcial)", () => {
    const board: BoardState = { novo: column([], 40), contato: column([], 0, { page: 0 }) };
    assert.deepEqual(boardSummary(stages, board), { ready: false, total: 0, open: 0, openValue: null });
  });
  it("totais REAIS do servidor; 'em andamento' exclui ganho e perdido", () => {
    const board: BoardState = {
      novo: column([lead(10)], 60), // só 1 de 60 carregado
      contato: column([], 25),
      ganho: column([], 5),
      perdido: column([], 10),
    };
    const s = boardSummary(stages, board);
    assert.equal(s.total, 100);
    assert.equal(s.open, 85);
    assert.equal(s.openValue, null); // 'novo' está parcial → não inventa valor
  });
  it("valor em andamento só quando TODAS as colunas abertas estão inteiras", () => {
    const board: BoardState = {
      novo: column([lead(100), lead(200)], 2),
      contato: column([lead(50)], 1),
      ganho: column([], 9), // fora do 'em andamento', pode estar parcial
      perdido: column([], 0),
    };
    assert.equal(boardSummary(stages, board).openValue, 350);
  });
  it("coluna com erro derruba o 'pronto'", () => {
    const board: BoardState = {
      novo: column([], 0),
      contato: column([], 0, { error: "falhou" }),
      ganho: column([], 0),
      perdido: column([], 0),
    };
    assert.equal(boardSummary(stages, board).ready, false);
  });
});
