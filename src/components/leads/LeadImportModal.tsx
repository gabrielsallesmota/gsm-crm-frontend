import { useId, useMemo, useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useLeadActions } from "../../hooks/useLeadActions";
import { parseCsv, readFileAsText } from "../../utils/csv";
import { ORIGIN_KEYS } from "../../constants/origins";
import {
  IMPORTABLE_LEAD_FIELDS,
  type DedupeStrategy,
  type ImportRowInput,
  type ImportSummary,
} from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { can } from "../../auth/permissions";
import styles from "../prospects/ProspectImportModal.module.css";
import { describeError } from "../../utils/apiErrors";

const IGNORE = "__ignore__";

const ENUM_KEYS: Partial<Record<keyof ImportRowInput, string[]>> = {
  origin: [...ORIGIN_KEYS],
};

function guessMapping(header: string): string {
  const normalized = header.trim().toLowerCase();
  const match = IMPORTABLE_LEAD_FIELDS.find(
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
    (row as Record<string, unknown>)[key] = raw;
  });
  if (!row.name) return null;
  return row as ImportRowInput;
}

export function LeadImportModal({
  pipelineId,
  stages,
  defaultStageId,
  onClose,
  onImported,
}: {
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { user } = useAuth();
  const uid = useId();
  const { bulkImport } = useLeadActions();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  // UUID REAL da etapa de entrada (Etapa 1: nada de chave "novo/contato").
  const [stageId, setStageId] = useState(defaultStageId);
  // Admin/gestor escolhem o dono dos leads importados; vendedor importa
  // sempre para si (o backend força isso).
  const canAssign = can(user, "leads.assign");
  const { data: team } = useTeamDirectory();
  const [ownerId, setOwnerId] = useState(user?.id ?? "");
  const [dedupeStrategy, setDedupeStrategy] = useState<DedupeStrategy>("skip");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parseError, setParseError] = useState("");

  const mappedRows = useMemo(
    () =>
      headers.length
        ? rows.map((r) => buildRow(headers, mapping, r)).filter((r): r is ImportRowInput => r !== null)
        : [],
    [headers, mapping, rows],
  );

  // N-03: por que "Importar" está desabilitado (a tela explica, em vez de só travar o botão).
  const nameMapped = mapping.includes("name");
  const blockedReason =
    headers.length === 0 || importing || mappedRows.length > 0
      ? null
      : nameMapped
        ? "Nenhuma linha pode ser importada: todas estão sem nome."
        : "Nome é obrigatório: associe uma coluna do arquivo ao campo Nome para importar.";

  async function handleFile(file: File) {
    setParseError("");
    setSummary(null);
    setFileName(file.name);
    try {
      const text = await readFileAsText(file);
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
    if (mappedRows.length === 0 || !user) return;
    if (!stages.some((s) => s.id === stageId)) {
      setParseError("Escolha a etapa de entrada dos leads.");
      return;
    }
    setImporting(true);
    try {
      const result = await bulkImport(
        mappedRows,
        pipelineId,
        stageId,
        canAssign && ownerId ? ownerId : user.id,
        dedupeStrategy,
      );
      setSummary(result);
    } catch (err) {
      setParseError(describeError(err, "Não foi possível importar."));
    } finally {
      setImporting(false);
    }
  }

  function handleFinish() {
    onImported();
    onClose();
  }

  return (
    // IMP-01: diálogo acessível compartilhado (papel, nome, foco preso/devolvido, Esc, proteção de dados).
    // Durante o envio o fechamento fica bloqueado, como no ConfirmDialog.
    <Modal
      title="Importar leads via CSV"
      subtitle="Suba a planilha, relacione cada coluna com um campo do lead (de/para) e escolha o que fazer quando o telefone já existir cadastrado."
      onClose={importing ? () => undefined : onClose}
    >
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
                  aria-label="Arquivo CSV com os leads"
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
                  <label className={styles.label} htmlFor={`${uid}-stage`} style={{ display: "block" }}>
                    Estágio de entrada (leads novos)
                  </label>
                  <select
                    id={`${uid}-stage`}
                    className={styles.select}
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                {canAssign && (
                  <div>
                    <label className={styles.label} htmlFor={`${uid}-owner`} style={{ display: "block" }}>
                      Responsável pelos leads novos
                    </label>
                    <select
                      id={`${uid}-owner`}
                      className={styles.select}
                      value={ownerId}
                      onChange={(e) => setOwnerId(e.target.value)}
                    >
                      {team?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      {!team && user && <option value={user.id}>Eu</option>}
                    </select>
                  </div>
                )}
                <div>
                  <label className={styles.label} htmlFor={`${uid}-dedupe`} style={{ display: "block" }}>
                    Se o telefone já existir
                  </label>
                  <select
                    id={`${uid}-dedupe`}
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
                    aria-label={`Campo do lead para a coluna ${header}`}
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
                    {IMPORTABLE_LEAD_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </>
          )}
          {parseError && (
            <p role="alert" style={{ color: "var(--tone-red)", fontSize: 12.5 }}>
              {parseError}
            </p>
          )}
        </>
      )}

      {blockedReason && !summary && (
        <p id={`${uid}-blocked`} role="status" style={{ color: "var(--tone-amber)", fontSize: 12.5 }}>
          {blockedReason}
        </p>
      )}

      <div className={styles.modalActions}>
        <Button onClick={onClose} disabled={importing}>
          {summary ? "Fechar" : "Cancelar"}
        </Button>
        {summary ? (
          <Button variant="primary" onClick={handleFinish}>
            Ver no pipeline
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={importing || mappedRows.length === 0}
            aria-describedby={blockedReason ? `${uid}-blocked` : undefined}
          >
            {importing ? "Importando…" : `Importar ${mappedRows.length || ""} lead(s)`}
          </Button>
        )}
      </div>
    </Modal>
  );
}
