import { BATCH_SIZE, MAX_FILE_BYTES, MAX_IMPORT_ROWS } from "../../../utils/leadImport";
import { formatBytes } from "./format";
import styles from "./ImportWizard.module.css";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);

/** Etapa 1 — escolher o arquivo e conhecer os limites antes de enviar qualquer coisa. */
export function StepFile({
  fileName,
  fileBytes,
  reading,
  error,
  onFile,
}: {
  fileName: string;
  fileBytes: number;
  reading: boolean;
  error: string;
  onFile: (file: File) => void;
}) {
  return (
    <>
      <h3 className={styles.title}>Escolha a planilha</h3>
      <p className={styles.lead}>
        Exporte sua planilha como CSV (separado por vírgula ou ponto e vírgula) e selecione o arquivo.
        Nada é enviado ao servidor até você confirmar a importação.
      </p>
      <div className={styles.dropzone}>
        {reading ? `Lendo ${fileName}…` : "Selecione um arquivo .csv exportado da sua planilha"}
        <div>
          <input
            type="file"
            aria-label="Arquivo CSV com os leads"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </div>
        {fileName && !reading && (
          <p className={styles.note}>
            {fileName} · {formatBytes(fileBytes)}
          </p>
        )}
      </div>
      <ul className={styles.limits}>
        <li>
          Até {fmt(MAX_IMPORT_ROWS)} linhas e {MAX_MB} MB por arquivo; o envio é feito em lotes de{" "}
          {BATCH_SIZE}.
        </li>
        <li>A primeira linha deve ser o cabeçalho (nome das colunas). O campo Nome é obrigatório.</li>
      </ul>
      {error && (
        <p role="alert" className={`${styles.note} ${styles.error}`}>
          {error}
        </p>
      )}
    </>
  );
}
