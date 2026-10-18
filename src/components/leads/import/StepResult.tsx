import { describeError } from "../../../utils/apiErrors";
import {
  KIND_LABEL,
  RESUME_SAFE_MS,
  type ImportState,
  type Report,
  type ReportKind,
  type RunOutcome,
} from "../../../utils/leadImport";
import { Button } from "../../common/Button";
import { REPORT_ROWS_SHOWN, STATE_LABEL, dateTime } from "./format";
import styles from "./ImportWizard.module.css";

const fmt = (n: number) => n.toLocaleString("pt-BR");
/** Orientação por tipo de problema encontrado — só o que de fato aparece neste relatório. */
const GUIDE: Partial<Record<ReportKind, string>> = {
  validation:
    "Linhas recusadas na validação: corrija o motivo indicado na planilha e importe novamente apenas essas linhas.",
  duplicate:
    "Duplicados ignorados: o telefone já estava cadastrado. Para atualizar esses cadastros, importe de novo escolhendo “Atualizar o cadastro existente”.",
  permission:
    "Sem permissão: o telefone pertence a um lead de outro responsável. Peça a um gestor para importar ou reatribuir.",
  processing:
    "Lotes não confirmados: o servidor pode ou não ter gravado essas linhas. Use “Retomar importação” (sem duplicar) em vez de importar de novo.",
  unprocessed:
    "Linhas não enviadas porque a importação foi interrompida. Use “Retomar importação” para enviar só o que falta.",
};

/** Etapa 5 — resultado final, relatório e o que fazer a seguir. */
export function StepResult({
  state,
  report,
  outcome,
  totalRows,
  batchesTotal,
  resumed,
  startedAt,
  now,
  onDownload,
}: {
  state: ImportState;
  report: Report;
  outcome: RunOutcome;
  totalRows: number;
  batchesTotal: number;
  resumed: boolean;
  startedAt: number;
  now: number;
  onDownload: () => void;
}) {
  const counts = report.counts;
  const problemRows = report.rows.filter((r) => r.kind !== "created" && r.kind !== "updated");
  const kindsPresent = (Object.keys(GUIDE) as ReportKind[]).filter((k) => counts[k] > 0);
  const interrupted = state === "failed" || state === "cancelled";
  const resumeUntil = startedAt + RESUME_SAFE_MS;
  const canResumeStill = startedAt > 0 && now < resumeUntil;

  return (
    <>
      <h3 className={styles.title}>Resultado da importação</h3>
      <div className={styles.summary}>
        <p role="status" className={styles.bigState}>
          {STATE_LABEL[state]}
        </p>
        {resumed && (
          <p className={styles.note} style={{ marginTop: 0 }}>
            Esta planilha retomou uma importação interrompida (iniciada em {dateTime(startedAt)}, dentro da
            janela de proteção de 24 h): o servidor reconhece os lotes já gravados e não os grava de novo.
          </p>
        )}
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Linhas no arquivo</dt>
            <dd>{fmt(totalRows)}</dd>
          </div>
          <div className={`${styles.stat} ${styles.statGood}`}>
            <dt>Criados</dt>
            <dd>{fmt(counts.created)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Atualizados</dt>
            <dd>{fmt(counts.updated)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Duplicados ignorados</dt>
            <dd>{fmt(counts.duplicate)}</dd>
          </div>
          <div className={`${styles.stat} ${counts.permission ? styles.statBad : ""}`}>
            <dt>Sem permissão</dt>
            <dd>{fmt(counts.permission)}</dd>
          </div>
          <div className={`${styles.stat} ${counts.validation ? styles.statBad : ""}`}>
            <dt>Falha de validação</dt>
            <dd>{fmt(counts.validation)}</dd>
          </div>
          <div className={`${styles.stat} ${counts.processing + counts.unprocessed ? styles.statBad : ""}`}>
            <dt>Não confirmadas</dt>
            <dd>{fmt(counts.processing + counts.unprocessed)}</dd>
          </div>
        </dl>
      </div>

      {state === "cancelled" && (
        <p className={styles.note} role="status">
          Você interrompeu a importação. Os lotes já enviados foram gravados e <strong>continuam no CRM</strong>
          ; nada foi desfeito.
        </p>
      )}
      {outcome.failure && (
        <p role="alert" className={`${styles.note} ${styles.error}`}>
          {describeError(outcome.failure.error, "Não foi possível importar.")} A importação parou no lote{" "}
          {outcome.failure.batchIndex + 1} de {batchesTotal}. Os lotes anteriores foram gravados; use “Retomar
          importação” para continuar sem duplicar.
        </p>
      )}
      {interrupted && (
        <p className={styles.note}>
          {canResumeStill
            ? `Você pode retomar esta importação até ${dateTime(resumeUntil)} (20 h após o início). Depois disso o servidor esquece os lotes e reenviar poderia duplicar: a retomada é bloqueada.`
            : "A janela segura de retomada (20 h) terminou: não é seguro reenviar os lotes. Prepare uma nova importação."}
        </p>
      )}

      {kindsPresent.length > 0 && (
        <>
          <p className={styles.summaryTitle}>O que fazer agora</p>
          <ul className={styles.guide}>
            {kindsPresent.map((k) => (
              <li key={k}>{GUIDE[k]}</li>
            ))}
          </ul>
        </>
      )}

      {problemRows.length > 0 && (
        <>
          <div className={styles.errorList} role="region" aria-label="Linhas que precisam de atenção" tabIndex={0}>
            {problemRows.slice(0, REPORT_ROWS_SHOWN).map((r) => (
              <div key={`${r.rowNumber}-${r.kind}`} className={styles.errorRow}>
                Linha {r.rowNumber} ({r.name || "sem nome"}) — {KIND_LABEL[r.kind]}
                {r.detail ? `: ${r.detail}` : ""}
              </div>
            ))}
          </div>
          {problemRows.length > REPORT_ROWS_SHOWN && (
            <p className={styles.note}>
              Mostrando {REPORT_ROWS_SHOWN} de {fmt(problemRows.length)}. Baixe o relatório para ver todas.
            </p>
          )}
        </>
      )}
      <div className={styles.actions} style={{ justifyContent: "flex-start", marginTop: "var(--space-3)" }}>
        <Button onClick={onDownload}>Baixar relatório (CSV)</Button>
      </div>
    </>
  );
}
