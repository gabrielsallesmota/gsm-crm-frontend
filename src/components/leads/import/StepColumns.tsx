import { IGNORE } from "../../../utils/leadImport";
import { IMPORTABLE_LEAD_FIELDS } from "../../../types/lead";
import { formatBytes } from "./format";
import styles from "./ImportWizard.module.css";

/** Etapa 2 — relacionar cada coluna do arquivo a um campo do lead (de/para). */
export function StepColumns({
  fileName,
  fileBytes,
  headers,
  rows,
  mapping,
  nameMapped,
  onMap,
}: {
  fileName: string;
  fileBytes: number;
  headers: string[];
  rows: string[][];
  mapping: string[];
  nameMapped: boolean;
  onMap: (colIndex: number, field: string) => void;
}) {
  const ignored = headers.filter((_, i) => (mapping[i] ?? IGNORE) === IGNORE);
  return (
    <>
      <h3 className={styles.title}>Relacione as colunas</h3>
      <div className={styles.fileCard}>
        <span className={styles.fileName}>{fileName}</span>
        <span>{formatBytes(fileBytes)}</span>
        <span>{rows.length} linha(s) encontrada(s)</span>
      </div>
      <p className={styles.lead}>
        Para cada coluna da sua planilha, escolha em qual campo do lead ela deve entrar. Colunas
        marcadas como “Ignorar coluna” não são importadas. O campo <strong>Nome</strong> é obrigatório.
      </p>
      <div className={styles.mappingHead} aria-hidden="true">
        <span>Coluna da planilha</span>
        <span>Exemplo (1ª linha)</span>
        <span>Campo do lead</span>
      </div>
      <div className={styles.mappingList}>
        {headers.map((header, colIndex) => (
          <div key={header + colIndex} className={styles.mappingRow}>
            <div className={styles.mappingHeader}>
              {header}
              {mapping[colIndex] === "name" && <span className={styles.required}>obrigatório</span>}
            </div>
            <div className={styles.mappingSample}>{rows[0]?.[colIndex] || "—"}</div>
            <select
              className={styles.select}
              aria-label={`Campo do lead para a coluna ${header}`}
              value={mapping[colIndex] ?? IGNORE}
              onChange={(e) => onMap(colIndex, e.target.value)}
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
      </div>
      {!nameMapped && (
        <p role="status" className={`${styles.note} ${styles.warn}`}>
          Nome é obrigatório: associe uma coluna do arquivo ao campo Nome para continuar.
        </p>
      )}
      {ignored.length > 0 && (
        <p className={styles.note}>
          Não serão importadas ({ignored.length}): {ignored.join(", ")}.
        </p>
      )}
    </>
  );
}
