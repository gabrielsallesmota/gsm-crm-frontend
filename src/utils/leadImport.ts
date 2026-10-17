// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import { ApiError } from "../types/common.ts";
import type { ImportRowInput, ImportSummary } from "../types/lead.ts";

/**
 * Importação de leads em LOTES (Fase 1B, D-10). Tudo aqui é lógica pura, sem React:
 *
 * - `prepareRows`: valida cada linha ANTES de enviar e separa válidas × inválidas (nada é
 *   descartado em silêncio: toda linha inválida tem o número original e um motivo);
 * - `runImport`: envia lotes de no máximo `BATCH_SIZE` linhas, UM de cada vez, cada lote com uma
 *   `Idempotency-Key` estável (`<importId>-<n>`). Se a resposta se perder (timeout, queda), o MESMO
 *   lote é reenviado com a MESMA chave e o servidor devolve o resultado já gravado — nunca grava
 *   duas vezes, inclusive com a estratégia "criar duplicado";
 * - `buildReport`: junta o resultado de cada lote, preservando o número da linha original.
 *
 * A garantia de integridade é do SERVIDOR (chave de idempotência persistida no banco); nada
 * aqui depende de estado em memória do navegador para evitar duplicação.
 */

export const MAX_IMPORT_ROWS = 10_000;
export const BATCH_SIZE = 500;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTEMPTS = 3;
export const IGNORE = "__ignore__";

/** Mesmas restrições do esquema do servidor (`ImportRowRequest`): nome ≤ 200, UF = 2 letras. */
const NAME_MAX = 200;
const STATE_MAX = 2;
/** Tamanho das colunas do banco (espelha `IMPORT_FIELD_LIMITS` do backend): um valor maior seria
 * recusado pelo servidor como erro DA LINHA; aqui a linha já é separada antes de enviar. */
const FIELD_LIMITS: Record<string, [label: string, max: number]> = {
  company: ["Empresa", 200],
  position: ["Cargo", 120],
  phone: ["Telefone", 30],
  whatsapp: ["WhatsApp", 30],
  email: ["E-mail", 255],
  city: ["Cidade", 120],
  notes: ["Observações", 4000],
};

export interface FieldDef {
  key: string;
  label: string;
}

export function guessMapping(header: string, fields: readonly FieldDef[]): string {
  const normalized = header.trim().toLowerCase();
  const match = fields.find(
    (f) => f.label.toLowerCase() === normalized || f.key.toLowerCase() === normalized,
  );
  return match?.key ?? IGNORE;
}

// ---------------------------------------------------------------------------------------------
// preparação e validação
// ---------------------------------------------------------------------------------------------

export interface PreparedRow {
  /** Número da linha como na planilha (cabeçalho = 1; primeira linha de dados = 2). */
  rowNumber: number;
  input: ImportRowInput;
}

export interface InvalidRow {
  rowNumber: number;
  name: string;
  detail: string;
}

export interface PrepareWarnings {
  /** Origens que não existem no CRM: o lead entra SEM origem (padrão do servidor). */
  unknownOrigin: number;
  /** Telefone/WhatsApp com menos de 10 dígitos: o lead é criado, mas sem deduplicação por telefone. */
  shortPhone: number;
}

export interface Prepared {
  totalRows: number;
  valid: PreparedRow[];
  invalid: InvalidRow[];
  warnings: PrepareWarnings;
  /** `true` quando alguma coluna está mapeada para Nome. */
  nameMapped: boolean;
}

function digits(value: string): number {
  return value.replace(/\D/g, "").length;
}

export function prepareRows(
  headers: readonly string[],
  mapping: readonly string[],
  rows: readonly (readonly string[])[],
  originKeys: readonly string[],
): Prepared {
  const nameMapped = mapping.includes("name");
  const valid: PreparedRow[] = [];
  const invalid: InvalidRow[] = [];
  const warnings: PrepareWarnings = { unknownOrigin: 0, shortPhone: 0 };

  rows.forEach((values, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const input: Record<string, string> = {};
    let rowUnknownOrigin = false;
    headers.forEach((_, col) => {
      const field = mapping[col];
      const raw = (values[col] ?? "").trim();
      if (!field || field === IGNORE || !raw) return;
      if (field === "origin") {
        const normalized = raw.toLowerCase();
        if (originKeys.includes(normalized)) input[field] = normalized;
        else rowUnknownOrigin = true;
        return;
      }
      input[field] = raw;
    });

    const name = input.name ?? "";
    if (!name) {
      invalid.push({ rowNumber, name: "", detail: "Nome é obrigatório." });
      return;
    }
    if (name.length > NAME_MAX) {
      invalid.push({ rowNumber, name: name.slice(0, 40), detail: `Nome com mais de ${NAME_MAX} caracteres.` });
      return;
    }
    if (input.state && input.state.length > STATE_MAX) {
      invalid.push({
        rowNumber,
        name,
        detail: "Estado (UF) deve ter 2 letras (ex.: SP).",
      });
      return;
    }
    const tooLong = Object.entries(FIELD_LIMITS).find(([field, [, max]]) => (input[field]?.length ?? 0) > max);
    if (tooLong) {
      const [field, [label, max]] = tooLong;
      invalid.push({ rowNumber, name, detail: `${label} tem ${input[field]!.length} caracteres; o máximo é ${max}.` });
      return;
    }
    if (rowUnknownOrigin) warnings.unknownOrigin += 1;
    const phones = [input.phone, input.whatsapp].filter((p): p is string => Boolean(p));
    if (phones.length > 0 && phones.every((p) => digits(p) < 10)) warnings.shortPhone += 1;
    valid.push({ rowNumber, input: input as unknown as ImportRowInput });
  });

  return { totalRows: rows.length, valid, invalid, warnings, nameMapped };
}

export function chunk<T>(items: readonly T[], size: number = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Valida o arquivo ANTES de processar (tamanho e quantidade de linhas). `null` = ok. */
export function checkLimits(fileBytes: number, dataRows: number): string | null {
  if (fileBytes > MAX_FILE_BYTES) {
    return `O arquivo tem ${(fileBytes / 1024 / 1024).toFixed(1)} MB; o limite é ${MAX_FILE_BYTES / 1024 / 1024} MB. Divida a planilha em partes menores.`;
  }
  if (dataRows > MAX_IMPORT_ROWS) {
    return `O arquivo tem ${dataRows.toLocaleString("pt-BR")} linhas de dados; o limite é ${MAX_IMPORT_ROWS.toLocaleString("pt-BR")}. Divida a planilha em arquivos menores. Nada foi importado.`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// execução em lotes
// ---------------------------------------------------------------------------------------------

export type ImportState =
  | "waiting" // arquivo lido, aguardando confirmação
  | "validating"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export type ReportKind =
  | "created"
  | "updated"
  | "duplicate" // ignorado: telefone já cadastrado
  | "permission" // ignorado: telefone de lead de outro responsável
  | "validation" // linha recusada na validação (no navegador ou no servidor)
  | "processing" // o lote não foi confirmado (falha após as tentativas)
  | "unprocessed"; // lote nunca enviado (importação interrompida/cancelada)

export interface ReportRow {
  rowNumber: number;
  name: string;
  kind: ReportKind;
  detail: string | null;
}

export interface BatchResult {
  index: number;
  rows: ReportRow[];
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface Progress {
  state: ImportState;
  validRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  batchesTotal: number;
  batchesDone: number;
  /** Lote em andamento (1-based) ou `null`. */
  currentBatch: number | null;
  /** Reenvio do mesmo lote (1 = primeira tentativa). */
  attempt: number;
}

// ---------------------------------------------------------------------------------------------
// janela segura de retomada (R4)
// ---------------------------------------------------------------------------------------------

/** Validade da chave de idempotência no servidor (`IDEMPOTENCY_TTL_HOURS`), contada a partir do
 * primeiro envio de cada lote. Depois disso o servidor ESQUECE o lote: reenviá-lo regravaria. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** Só retomamos dentro de 20 h do INÍCIO da importação (folga de 4 h para relógio, sono do
 * notebook e a própria duração do reenvio). O início nunca é renovado ao retomar. */
export const RESUME_SAFE_MS = 20 * 60 * 60 * 1000;
/** Tolerância para relógio do aparelho adiantado/atrasado (início "no futuro" além disso = suspeito). */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface ResumeRecord {
  sig: string;
  importId: string;
  /** Início da importação (primeiro envio). Gravado UMA vez; retomar não o renova. */
  startedAt: number;
}

export type ResumeStatus =
  | { kind: "none" }
  | { kind: "fresh"; importId: string; startedAt: number }
  | { kind: "expired"; startedAt: number };

export function isWithinSafeWindow(startedAt: number, now: number): boolean {
  const age = now - startedAt;
  return age >= -CLOCK_SKEW_MS && age < RESUME_SAFE_MS;
}

/** O que fazer com um registro de importação anterior para ESTA planilha e estes parâmetros. */
export function resumeStatus(record: ResumeRecord | null, signature: string, now: number): ResumeStatus {
  if (!record || record.sig !== signature) return { kind: "none" };
  if (!Number.isFinite(record.startedAt)) return { kind: "expired", startedAt: 0 };
  return isWithinSafeWindow(record.startedAt, now)
    ? { kind: "fresh", importId: record.importId, startedAt: record.startedAt }
    : { kind: "expired", startedAt: record.startedAt };
}

/** Identificador da importação: base das chaves de idempotência de todos os lotes. */
export function newImportId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 16);
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Assinatura curta (não criptográfica) do que identifica "a mesma importação" para retomar. */
export function signatureOf(parts: readonly string[]): string {
  let h = 5381;
  for (const ch of parts.join("|")) h = ((h << 5) + h + ch.codePointAt(0)!) | 0;
  return (h >>> 0).toString(36);
}

export function importKey(importId: string, index: number): string {
  return `imp-${importId}-${String(index).padStart(4, "0")}`;
}

/** Falhas que valem uma nova tentativa com a MESMA chave (a resposta pode ter se perdido). */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500;
  }
  return true; // rede / erro não-HTTP
}

export function describeFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "sem conexão com o servidor";
    if (error.status >= 500) return "erro no servidor";
    return error.message || `recusado pelo servidor (${error.status})`;
  }
  return "falha de comunicação";
}

function reportKindOf(row: ImportSummary["rows"][number]): ReportKind {
  if (row.outcome === "created") return "created";
  if (row.outcome === "updated") return "updated";
  if (row.outcome === "skipped") return row.reason === "permission" ? "permission" : "duplicate";
  return "validation";
}

export function toBatchResult(index: number, rows: readonly PreparedRow[], summary: ImportSummary): BatchResult {
  const reportRows: ReportRow[] = summary.rows.map((r) => ({
    // `rowIndex` é relativo ao LOTE; o número original vem da linha preparada.
    rowNumber: rows[r.rowIndex]?.rowNumber ?? -1,
    name: r.name,
    kind: reportKindOf(r),
    detail: r.detail,
  }));
  return {
    index,
    rows: reportRows,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    errors: summary.errors,
  };
}

export interface RunOptions {
  batches: readonly (readonly PreparedRow[])[];
  importId: string;
  /** Lotes já concluídos (retomada). Serão reenviados? NÃO: só os que faltam. */
  done?: ReadonlyMap<number, BatchResult>;
  send: (rows: ImportRowInput[], key: string) => Promise<ImportSummary>;
  onProgress: (progress: Progress) => void;
  isCancelled: () => boolean;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunOutcome {
  state: "completed" | "failed" | "cancelled";
  results: Map<number, BatchResult>;
  /** Lote que falhou após as tentativas (a execução para nele). */
  failure: { batchIndex: number; message: string; error: unknown; rowNumbers: number[] } | null;
}

const BACKOFF_MS = [800, 2000, 4000];
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function totals(results: ReadonlyMap<number, BatchResult>, batches: readonly (readonly PreparedRow[])[]) {
  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  for (const [index, r] of results) {
    processed += batches[index]?.length ?? 0;
    created += r.created;
    updated += r.updated;
    skipped += r.skipped;
    errors += r.errors;
  }
  return { processed, created, updated, skipped, errors };
}

export async function runImport(options: RunOptions): Promise<RunOutcome> {
  const { batches, importId, send, onProgress, isCancelled } = options;
  const sleep = options.sleep ?? defaultSleep;
  const results = new Map<number, BatchResult>(options.done ?? []);
  const validRows = batches.reduce((n, b) => n + b.length, 0);
  const emit = (state: ImportState, current: number | null, attempt: number) => {
    onProgress({
      state,
      validRows,
      ...totals(results, batches),
      batchesTotal: batches.length,
      batchesDone: results.size,
      currentBatch: current,
      attempt,
    });
  };

  for (let index = 0; index < batches.length; index++) {
    if (results.has(index)) continue; // já concluído em uma tentativa anterior
    if (isCancelled()) {
      emit("cancelled", null, 1);
      return { state: "cancelled", results, failure: null };
    }
    const batch = batches[index]!;
    let lastError: unknown = null;
    let summary: ImportSummary | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      emit("processing", index + 1, attempt);
      try {
        summary = await send(
          batch.map((r) => r.input),
          importKey(importId, index),
        );
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        await sleep(BACKOFF_MS[attempt - 1] ?? 4000);
      }
    }
    if (summary === null) {
      const message = describeFailure(lastError);
      emit("failed", null, MAX_ATTEMPTS);
      return {
        state: "failed",
        results,
        failure: { batchIndex: index, message, error: lastError, rowNumbers: batch.map((r) => r.rowNumber) },
      };
    }
    results.set(index, toBatchResult(index, batch, summary));
    emit("processing", null, 1);
  }
  emit("completed", null, 1);
  return { state: "completed", results, failure: null };
}

// ---------------------------------------------------------------------------------------------
// relatório
// ---------------------------------------------------------------------------------------------

export interface Report {
  rows: ReportRow[];
  counts: Record<ReportKind, number>;
}

export function buildReport(
  prepared: Prepared,
  batches: readonly (readonly PreparedRow[])[],
  outcome: RunOutcome,
): Report {
  const rows: ReportRow[] = prepared.invalid.map((r) => ({
    rowNumber: r.rowNumber,
    name: r.name,
    kind: "validation" as const,
    detail: r.detail,
  }));
  batches.forEach((batch, index) => {
    const result = outcome.results.get(index);
    if (result) {
      rows.push(...result.rows);
    } else if (outcome.failure?.batchIndex === index) {
      for (const r of batch) {
        rows.push({
          rowNumber: r.rowNumber,
          name: r.input.name,
          kind: "processing",
          detail: `Lote ${index + 1} não confirmado (${outcome.failure.message}). Retomar a importação reenvia este lote com segurança.`,
        });
      }
    } else {
      for (const r of batch) {
        rows.push({
          rowNumber: r.rowNumber,
          name: r.input.name,
          kind: "unprocessed",
          detail: "Não processada: a importação foi interrompida antes deste lote.",
        });
      }
    }
  });
  rows.sort((a, b) => a.rowNumber - b.rowNumber);
  const counts: Record<ReportKind, number> = {
    created: 0,
    updated: 0,
    duplicate: 0,
    permission: 0,
    validation: 0,
    processing: 0,
    unprocessed: 0,
  };
  for (const r of rows) counts[r.kind] += 1;
  return { rows, counts };
}

/** Estado final a partir do relatório: só "Concluído" quando nada foi rejeitado ou deixou de ser confirmado. */
export function finalState(outcome: RunOutcome, report: Report): ImportState {
  if (outcome.state === "cancelled") return "cancelled";
  if (outcome.state === "failed") return "failed";
  const c = report.counts;
  return c.validation + c.permission + c.processing + c.unprocessed > 0 ? "completed_with_errors" : "completed";
}

export const KIND_LABEL: Record<ReportKind, string> = {
  created: "Criado",
  updated: "Atualizado",
  duplicate: "Duplicado ignorado",
  permission: "Sem permissão (outro responsável)",
  validation: "Falha de validação",
  processing: "Erro de processamento (não confirmado)",
  unprocessed: "Não processado",
};

/** Neutraliza fórmulas ao abrir no Excel/Sheets (mesma regra do export do servidor). */
export function csvSafeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvField(value: string): string {
  const safe = csvSafeCell(value);
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Marca de ordem de bytes UTF-8: o Excel só reconhece acentos no CSV com ela. */
const BOM_CHAR = String.fromCharCode(0xfeff);

/** CSV do relatório SEM as linhas de sucesso (o que precisa de atenção), com BOM para o Excel. */
export function reportToCsv(report: Report): string {
  const header = ["Linha", "Nome", "Resultado", "Motivo"];
  const lines = report.rows
    .filter((r) => r.kind !== "created" && r.kind !== "updated")
    .map((r) => [String(r.rowNumber), r.name, KIND_LABEL[r.kind], r.detail ?? ""].map(csvField).join(","));
  return BOM_CHAR + `${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
