import type { Progress } from "../../../utils/leadImport";
import { STATE_LABEL } from "./format";
import styles from "./ImportWizard.module.css";

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Etapa 4 — progresso REAL (linhas já confirmadas pelo servidor, nunca estimativa). */
export function StepProgress({ progress, stopping }: { progress: Progress | null; stopping: boolean }) {
  if (!progress) {
    return (
      <>
        <h3 className={styles.title}>Importando…</h3>
        <p role="status" className={styles.note}>
          Preparando o envio…
        </p>
      </>
    );
  }
  const percent = progress.validRows > 0 ? Math.floor((progress.processed / progress.validRows) * 100) : 0;
  return (
    <>
      <h3 className={styles.title}>Importando…</h3>
      <div className={styles.summary}>
        <p className={styles.bigState}>Estado: {STATE_LABEL[progress.state]}</p>
        <progress
          className={styles.progressBar}
          aria-label="Progresso da importação"
          max={progress.validRows}
          value={progress.processed}
        />
        <p role="status" className={styles.note}>
          {stopping
            ? "Interrompendo depois do lote em andamento… "
            : progress.currentBatch !== null
              ? `Enviando lote ${progress.currentBatch} de ${progress.batchesTotal}${progress.attempt > 1 ? ` (nova tentativa ${progress.attempt})` : ""}… `
              : "Aguardando o próximo lote… "}
          {fmt(progress.processed)} de {fmt(progress.validRows)} linhas processadas ({percent}%).
        </p>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Criados</dt>
            <dd>{fmt(progress.created)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Atualizados</dt>
            <dd>{fmt(progress.updated)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Ignorados</dt>
            <dd>{fmt(progress.skipped)}</dd>
          </div>
          <div className={`${styles.stat} ${progress.errors ? styles.statBad : ""}`}>
            <dt>Com erro</dt>
            <dd>{fmt(progress.errors)}</dd>
          </div>
        </dl>
      </div>
      <p className={styles.note}>
        Mantenha esta janela aberta até terminar. Interromper para depois do lote em andamento; o que já foi
        gravado permanece (não é desfeito).
      </p>
    </>
  );
}
