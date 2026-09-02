import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import { useProspectActions } from "../../hooks/useProspectActions";
import { parseCsv } from "../../utils/csv";
import {
  IMPORTABLE_PROSPECT_FIELDS,
  type DedupeStrategy,
  type ImportRowInput,
  type ImportSummary,
  type ProspectStage,
} from "../../types/prospect";
import {
  PAGE_OBJECTIVE,
  PHONE_TYPE,
  PRIORITY,
  PROSPECT_ORIGIN,
  SITE_STATUS,
  WHATSAPP_STATUS,
} from "../../constants/prospectEnums";
import styles from "./ProspectImportModal.module.css";

const IGNORE = "__ignore__";

const ENUM_KEYS: Partial<Record<keyof ImportRowInput, string[]>> = {
  phoneType: Object.keys(PHONE_TYPE),
  whatsappStatus: Object.keys(WHATSAPP_STATUS),
  siteStatus: Object.keys(SITE_STATUS),
  pageObjective: Object.keys(PAGE_OBJECTIVE),
  priority: Object.keys(PRIORITY),
  origin: Object.keys(PROSPECT_ORIGIN),
};

const NUMBER_FIELDS = new Set<keyof ImportRowInput>(["googleRating", "googleReviewsCount"]);
const DATE_FIELDS = new Set<keyof ImportRowInput>(["initialContactDate"]);

/** Aceita tanto "02/09/2026" (planilha brasileira, dia/mês/ano) quanto
 * "2026-09-02" (ISO, ex.: reimportando o próprio CSV exportado daqui) e
 * devolve sempre ISO — o que o backend espera (`date` do Pydantic). Datas
 * fora desses dois formatos, ou inválidas (ex. "31/02"), são ignoradas em
 * vez de quebrar a linha (mesmo espírito do resto do import — ver
 * `buildRow`); nesse caso o backend assume "hoje" no lugar do P0. */
function parseFlexibleDate(raw: string): string | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(raw);
  if (!br) return undefined;
  const [, dayStr, monthStr, yearStr] = br;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = (yearStr ?? "").length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isValid) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Apelidos comuns de cabeçalho de planilha pro campo P0 — a maioria dos
// times de SDR não escreve o rótulo completo ("Data do primeiro contato
// (P0)"), então o de/para vem com "Ignorar coluna" sem isso (usuário ainda
// pode mapear manualmente, isso só melhora o palpite automático).
const INITIAL_CONTACT_DATE_ALIASES = new Set([
  "p0",
  "data p0",
  "data inicial",
  "primeiro contato",
  "data do primeiro contato",
  "data de contato",
  "data de contato inicial",
]);

function guessMapping(header: string): string {
  const normalized = header.trim().toLowerCase();
  if (INITIAL_CONTACT_DATE_ALIASES.has(normalized)) return "initialContactDate";
  const match = IMPORTABLE_PROSPECT_FIELDS.find(
    (f) => f.label.toLowerCase() === normalized || f.key.toLowerCase() === normalized,
  );
  return match?.key ?? IGNORE;
}

function buildRow(headers: string[], mapping: string[], values: string[]): ImportRowInput | null {
  const row: Partial<ImportRowInput> = {};
  headers.forEach((_, colIndex) => {
    const field = mapping[colIndex];
    const raw = (values[colIndex] ?? "").trim();
    if (!field || field === IGNORE || !raw) return;

    const key = field as keyof ImportRowInput;
    const enumKeys = ENUM_KEYS[key];
    if (enumKeys) {
      const normalized = raw.trim().toLowerCase();
      if (!enumKeys.includes(normalized)) return; // valor não bate com o enum — ignora em vez de quebrar o lote inteiro
      (row as Record<string, unknown>)[key] = normalized;
      return;
    }
    if (NUMBER_FIELDS.has(key)) {
      const num = Number(raw.replace(",", "."));
      if (!Number.isNaN(num)) (row as Record<string, unknown>)[key] = num;
      return;
    }
    if (DATE_FIELDS.has(key)) {
      const iso = parseFlexibleDate(raw);
      if (iso) (row as Record<string, unknown>)[key] = iso;
      return;
    }
    (row as Record<string, unknown>)[key] = raw;
  });
  if (!row.companyName) return null;
  return row as ImportRowInput;
}

export function ProspectImportModal({
  stages,
  defaultStageId,
  onClose,
  onImported,
}: {
  stages: ProspectStage[];
  defaultStageId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { bulkImport } = useProspectActions();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [stageId, setStageId] = useState(defaultStageId);
  const [dedupeStrategy, setDedupeStrategy] = useState<DedupeStrategy>("skip");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parseError, setParseError] = useState("");

  const mappedRows = useMemo(
    () => (headers.length ? rows.map((r) => buildRow(headers, mapping, r)).filter((r): r is ImportRowInput => r !== null) : []),
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
      const result = await bulkImport(mappedRows, stageId, dedupeStrategy);
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
        <h2 className={styles.modalTitle}>Importar prospects via CSV</h2>
        <p className={styles.modalSubtitle}>
          Suba a planilha, relacione cada coluna com um campo da pipeline (de/para) e escolha o que
          fazer quando o telefone já existir cadastrado. Mapeie "Data do primeiro contato (P0)" pra
          cada linha ter sua própria data — sem essa coluna, todas entram com a data de hoje. As
          datas dos follow-ups seguintes são calculadas sozinhas a partir daí (configure a cadência
          em "Estágios"). Mapeie "Mensagem 1".."Mensagem 4" pra cada prospect ter sua própria
          mensagem de WhatsApp por etapa — configure em "Estágios" qual campo cada uma usa.
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
                      Linha {r.rowIndex + 1} ({r.companyName || "sem nome"}): {r.detail}
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
                    <div className={styles.label}>Estágio de entrada (leads novos)</div>
                    <select
                      className={styles.select}
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={styles.label}>Se o telefone já existir</div>
                    <select
                      className={styles.select}
                      value={dedupeStrategy}
                      onChange={(e) => setDedupeStrategy(e.target.value as DedupeStrategy)}
                    >
                      <option value="skip">Ignorar a linha</option>
                      <option value="update">Atualizar o cadastro existente</option>
                      <option value="duplicate">Cadastrar mesmo assim (duplicar)</option>
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
                      {IMPORTABLE_PROSPECT_FIELDS.map((f) => (
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
              Ver na pipeline
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={importing || mappedRows.length === 0}
            >
              {importing ? "Importando…" : `Importar ${mappedRows.length || ""} prospect(s)`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
