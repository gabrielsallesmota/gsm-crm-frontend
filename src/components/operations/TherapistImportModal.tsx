import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { operationsApiRepository } from "../../repositories/api/OperationsApiRepository";
import { parseCsv } from "../../utils/csv";
import {
  IMPORTABLE_THERAPIST_FIELDS,
  type DedupeStrategy,
  type ImportSummary,
  type TherapistImportRowInput,
} from "../../types/operations";
import styles from "../prospects/ProspectImportModal.module.css";

const IGNORE = "__ignore__";

function guessMapping(header: string): string {
  const normalized = header.trim().toLowerCase();
  const match = IMPORTABLE_THERAPIST_FIELDS.find(
    (f) => f.label.toLowerCase() === normalized || f.key.toLowerCase() === normalized,
  );
  return match?.key ?? IGNORE;
}

function parseBoolean(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return !["false", "0", "nao", "não", "inativo", "n"].includes(v);
}

function buildRow(headers: string[], mapping: string[], values: string[]): TherapistImportRowInput | null {
  const row: Partial<TherapistImportRowInput> = {};
  headers.forEach((_, colIndex) => {
    const field = mapping[colIndex];
    const raw = (values[colIndex] ?? "").trim();
    if (!field || field === IGNORE || !raw) return;
    if (field === "active") {
      row.active = parseBoolean(raw);
      return;
    }
    (row as Record<string, unknown>)[field] = raw;
  });
  if (!row.code || !row.name) return null;
  return row as TherapistImportRowInput;
}

export function TherapistImportModal({
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
  const [dedupeStrategy, setDedupeStrategy] = useState<DedupeStrategy>("skip");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parseError, setParseError] = useState("");

  const mappedRows = useMemo(
    () =>
      headers.length
        ? rows
            .map((r) => buildRow(headers, mapping, r))
            .filter((r): r is TherapistImportRowInput => r !== null)
        : [],
    [headers, mapping, rows],
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
      const result = await operationsApiRepository.bulkImportTherapists(mappedRows, dedupeStrategy);
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
        <h2 className={styles.modalTitle}>Importar terapeutas via CSV</h2>
        <p className={styles.modalSubtitle}>
          Suba a planilha, relacione cada coluna com um campo (de/para) e escolha o que fazer
          quando o código já existir cadastrado.
        </p>

        {summary ? (
          <div className={styles.summary}>
            <div className={styles.summaryStats}>
              <span>
                Linhas processadas: <strong>{summary.total}</strong>
              </span>
              <span>
                Criados: <strong>{summary.created}</strong>
              </span>
              <span>
                Atualizados: <strong>{summary.updated}</strong>
              </span>
              <span>
                Ignorados: <strong>{summary.skipped}</strong>
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
                      Linha {r.rowIndex + 1} ({r.name || "sem nome"}): {r.detail}
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
                <div className={styles.row}>
                  <div>
                    <div className={styles.label}>Se o código já existir</div>
                    <select
                      className={styles.select}
                      value={dedupeStrategy}
                      onChange={(e) => setDedupeStrategy(e.target.value as DedupeStrategy)}
                    >
                      <option value="skip">Ignorar a linha</option>
                      <option value="update">Atualizar o cadastro existente</option>
                    </select>
                  </div>
                </div>

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
                      {IMPORTABLE_THERAPIST_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
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
              Ver terapeutas
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={importing || mappedRows.length === 0}
            >
              {importing ? "Importando…" : `Importar ${mappedRows.length || ""} terapeuta(s)`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
