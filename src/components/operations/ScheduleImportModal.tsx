import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { operationsApiRepository } from "../../repositories/api/OperationsApiRepository";
import { parseCsv } from "../../utils/csv";
import {
  IMPORTABLE_SCHEDULE_FIELDS,
  type ImportSummary,
  type Shift,
  type ScheduleImportRowInput,
} from "../../types/operations";
import styles from "../prospects/ProspectImportModal.module.css";

const IGNORE = "__ignore__";

// Aceita as variações mais comuns que uma planilha em português costuma
// usar (com/sem acento, "interjornada"/"interturno", e "Tarde"/
// "Intermediário" — os nomes que a escala real da loja usa pros turnos
// 16h–22h e 14h–20h) — o backend só aceita os códigos canônicos
// ("manha"/"inter"/"noturno").
const SHIFT_ALIASES: Record<string, Shift> = {
  manha: "manha",
  "manhã": "manha",
  inter: "inter",
  interturno: "inter",
  "inter-turno": "inter",
  interjornada: "inter",
  intermediario: "inter",
  "intermediário": "inter",
  noturno: "noturno",
  noite: "noturno",
  tarde: "noturno",
};

function normalizeShift(raw: string): Shift | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, ""); // tira acento pra bater "manhã"/"manha" no mesmo alias
  return SHIFT_ALIASES[key] ?? SHIFT_ALIASES[raw.trim().toLowerCase()] ?? null;
}

// Planilha brasileira normalmente exporta dd/mm/aaaa — o backend só aceita
// ISO (yyyy-mm-dd, o que o <input type="date"> também usa).
function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const brMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  return null;
}

function guessMapping(header: string): string {
  const normalized = header.trim().toLowerCase();
  const match = IMPORTABLE_SCHEDULE_FIELDS.find(
    (f) => f.label.toLowerCase() === normalized || f.key.toLowerCase() === normalized,
  );
  return match?.key ?? IGNORE;
}

function buildRow(
  headers: string[],
  mapping: string[],
  values: string[],
): { row: ScheduleImportRowInput; error: string | null } | null {
  const partial: Partial<ScheduleImportRowInput> = {};
  let error: string | null = null;

  headers.forEach((_, colIndex) => {
    const field = mapping[colIndex];
    const raw = (values[colIndex] ?? "").trim();
    if (!field || field === IGNORE || !raw) return;

    if (field === "date") {
      const iso = normalizeDate(raw);
      if (!iso) {
        error = `Data inválida: '${raw}' (use dd/mm/aaaa ou aaaa-mm-dd)`;
        return;
      }
      partial.date = iso;
      return;
    }
    if (field === "shift") {
      const shift = normalizeShift(raw);
      if (!shift) {
        error = `Turno inválido: '${raw}' (use manhã, intermediário/interturno ou tarde/noturno)`;
        return;
      }
      partial.shift = shift;
      return;
    }
    (partial as Record<string, unknown>)[field] = raw;
  });

  if (!partial.therapistCode && !partial.date && !partial.shift) return null; // linha em branco
  if (!error && (!partial.therapistCode || !partial.date || !partial.shift)) {
    error = "Código ou nome do terapeuta, data e turno são obrigatórios";
  }
  return { row: partial as ScheduleImportRowInput, error };
}

export function ScheduleImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parseError, setParseError] = useState("");

  const built = useMemo(
    () => (headers.length ? rows.map((r) => buildRow(headers, mapping, r)) : []),
    [headers, mapping, rows],
  );
  const mappedRows = useMemo(
    () => built.flatMap((b) => (b && !b.error ? [b.row] : [])),
    [built],
  );
  const rowErrors = useMemo(
    () => built.filter((b): b is { row: ScheduleImportRowInput; error: string } => !!b?.error),
    [built],
  );

  async function handleFile(file: File) {
    setParseError("");
    setSummary(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setParseError("Não foi possível ler colunas nesse arquivo.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(parsed.headers.map(guessMapping));
    } catch {
      setParseError("Não foi possível ler esse arquivo como CSV.");
    }
  }

  async function handleSubmit() {
    if (mappedRows.length === 0) return;
    setImporting(true);
    try {
      const result = await operationsApiRepository.bulkImportSchedule(mappedRows);
      setSummary(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Não foi possível importar.");
    } finally {
      setImporting(false);
    }
  }

  function handleFinish() {
    onImported();
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Importar escala via CSV</h2>
        <p className={styles.modalSubtitle}>
          Suba a planilha do mês, relacione cada coluna com um campo (de/para) — código ou nome
          do terapeuta (o mesmo cadastrado na aba Terapeutas), data e turno. Uma linha por
          terapeuta e dia trabalhado; se o mesmo terapeuta trabalha dois turnos no mesmo dia, é
          uma linha pra cada turno. Dia sem um dos turnos (ex.: domingo só de manhã) não precisa
          de linha nenhuma pros turnos que não existem naquele dia — só importa o que estiver na
          planilha.
        </p>

        {summary ? (
          <div className={styles.summary}>
            <div className={styles.summaryStats}>
              <span>
                Linhas processadas: <strong>{summary.total}</strong>
              </span>
              <span>
                Criadas: <strong>{summary.created}</strong>
              </span>
              <span>
                Ignoradas (já escalado): <strong>{summary.skipped}</strong>
              </span>
              <span>
                Com erro: <strong>{summary.errors}</strong>
              </span>
            </div>
            {summary.rows.some((r) => r.outcome === "error") && (
              <div className={styles.errorList}>
                {summary.rows
                  .filter((r) => r.outcome === "error")
                  .map((r) => (
                    <div key={r.rowIndex} className={styles.errorRow}>
                      Linha {r.rowIndex + 1} ({r.name || "sem terapeuta"}): {r.detail}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {headers.length === 0 ? (
              <div className={styles.dropzone}>
                {fileName ? `Lendo ${fileName}…` : "Selecione um arquivo .csv exportado da sua planilha"}
                <div>
                  <input
                    className={styles.fileInput}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.label} style={{ marginBottom: 8 }}>
                  {rows.length} linha(s) encontrada(s) — relacione as colunas:
                </div>
                {headers.map((header, colIndex) => (
                  <div key={header + colIndex} className={styles.mappingRow}>
                    <div>
                      <div className={styles.mappingHeader}>{header}</div>
                      <div className={styles.mappingSample}>{rows[0]?.[colIndex] || "—"}</div>
                    </div>
                    <select
                      className={styles.select}
                      value={mapping[colIndex] ?? IGNORE}
                      onChange={(e) =>
                        setMapping((m) => {
                          const next = [...m];
                          next[colIndex] = e.target.value;
                          return next;
                        })
                      }
                    >
                      <option value={IGNORE}>Ignorar coluna</option>
                      {IMPORTABLE_SCHEDULE_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {rowErrors.length > 0 && (
                  <div className={styles.errorList}>
                    {rowErrors.slice(0, 5).map((b, i) => (
                      <div key={i} className={styles.errorRow}>
                        {b.error}
                      </div>
                    ))}
                    {rowErrors.length > 5 && (
                      <div className={styles.errorRow}>
                        + {rowErrors.length - 5} outra(s) linha(s) com problema — ajuste o de/para
                        ou corrija a planilha.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {parseError && <p style={{ color: "#ff6b6b", fontSize: 12.5 }}>{parseError}</p>}
          </>
        )}

        <div className={styles.modalActions}>
          <Button onClick={onClose} disabled={importing}>
            {summary ? "Fechar" : "Cancelar"}
          </Button>
          {summary ? (
            <Button variant="primary" onClick={handleFinish}>
              Ver escala
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={importing || mappedRows.length === 0}
            >
              {importing ? "Importando…" : `Importar ${mappedRows.length || ""} linha(s)`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
