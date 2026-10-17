import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useLeadActions } from "../../hooks/useLeadActions";
import { parseCsv, readFileAsText } from "../../utils/csv";
import { ORIGIN_KEYS } from "../../constants/origins";
import { IMPORTABLE_LEAD_FIELDS, type DedupeStrategy } from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { can } from "../../auth/permissions";
import styles from "../prospects/ProspectImportModal.module.css";
import { describeError } from "../../utils/apiErrors";
import {
  BATCH_SIZE,
  IGNORE,
  KIND_LABEL,
  MAX_IMPORT_ROWS,
  buildReport,
  checkLimits,
  chunk,
  finalState,
  guessMapping,
  isWithinSafeWindow,
  newImportId,
  prepareRows,
  reportToCsv,
  resumeStatus,
  runImport,
  signatureOf,
  type BatchResult,
  type ImportState,
  type Progress,
  type Report,
  type ResumeRecord,
  type RunOutcome,
} from "../../utils/leadImport";

const STATE_LABEL: Record<ImportState, string> = {
  waiting: "Aguardando",
  validating: "Validando",
  processing: "Processando",
  completed: "Concluído",
  completed_with_errors: "Concluído com erros",
  failed: "Falhou",
  cancelled: "Cancelada",
};

/** Quantas linhas problemáticas aparecem na tela; o relatório completo é o CSV baixável. */
const REPORT_ROWS_SHOWN = 200;

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Um registro por (tenant, usuário, assinatura da planilha+parâmetros): importar outra planilha
 * não apaga o registro de uma interrompida. */
function resumeKey(prefix: string, signature: string): string {
  return `${prefix}.${signature}`;
}

function readResume(prefix: string, signature: string): ResumeRecord | null {
  try {
    const raw = window.localStorage.getItem(resumeKey(prefix, signature));
    return raw ? (JSON.parse(raw) as ResumeRecord) : null;
  } catch {
    return null;
  }
}

function writeResume(prefix: string, record: ResumeRecord) {
  try {
    window.localStorage.setItem(resumeKey(prefix, record.sig), JSON.stringify(record));
  } catch {
    // sem armazenamento: só perde a retomada após recarregar a página
  }
}

function clearResume(prefix: string, signature: string) {
  try {
    window.localStorage.removeItem(resumeKey(prefix, signature));
  } catch {
    // nada a limpar
  }
}

/** Por quanto tempo lembramos que uma planilha já foi enviada (só assinatura + id + data, sem dados
 * pessoais). Passadas as 24 h do servidor o registro NÃO serve mais para retomar, mas continua
 * servindo para AVISAR que a planilha já foi enviada (senão reenviá-la com "duplicar" criaria
 * duplicados sem nenhum alerta). */
const RECORD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Remove registros muito antigos. */
function pruneResume(prefix: string, now: number) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(`${prefix}.`)) continue;
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as ResumeRecord | null;
      if (!saved || !Number.isFinite(saved.startedAt) || now - saved.startedAt >= RECORD_RETENTION_MS) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignora
  }
}

const dateTime = (ms: number) =>
  ms > 0 ? new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "data desconhecida";

function downloadCsv(name: string, content: string) {
  if (typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function LeadImportModal({
  pipelineId,
  stages,
  defaultStageId,
  onClose,
  onImported,
  retrySleep,
}: {
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId: string;
  onClose: () => void;
  onImported: () => void;
  /** Só para testes: troca a espera entre tentativas. */
  retrySleep?: (ms: number) => Promise<void>;
}) {
  const { user, currentTenantId } = useAuth();
  const uid = useId();
  const { bulkImport } = useLeadActions();
  const [fileName, setFileName] = useState("");
  const [fileBytes, setFileBytes] = useState(0);
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
  const [parseError, setParseError] = useState("");

  // execução
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<{ state: ImportState; report: Report; outcome: RunOutcome } | null>(null);
  const [resumed, setResumed] = useState(false);
  const cancelRef = useRef(false);
  const doneBatches = useRef(new Map<number, BatchResult>());
  const importIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  // Proteção contra duplicação vencida: nada é reenviado até a pessoa decidir (R4).
  const [expired, setExpired] = useState<{ startedAt: number } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Saiu da tela (navegou para outra rota) no meio da importação: ela PARA depois do lote em
      // voo, em vez de seguir invisível. O registro de retomada fica guardado.
      cancelRef.current = true;
    };
  }, []);

  const originKeys = useMemo(() => [...ORIGIN_KEYS] as string[], []);
  const prepared = useMemo(
    () => (headers.length ? prepareRows(headers, mapping, rows, originKeys) : null),
    [headers, mapping, rows, originKeys],
  );
  const batches = useMemo(() => (prepared ? chunk(prepared.valid, BATCH_SIZE) : []), [prepared]);
  const validCount = prepared?.valid.length ?? 0;
  const running = phase === "running";

  // N-03: por que "Importar" está desabilitado (a tela explica, em vez de só travar o botão).
  const blockedReason =
    !prepared || running || phase === "done" || validCount > 0
      ? null
      : prepared.nameMapped
        ? "Nenhuma linha pode ser importada: todas estão sem nome."
        : "Nome é obrigatório: associe uma coluna do arquivo ao campo Nome para importar.";

  // Fechar a aba no meio da importação interrompe a fila: avisa antes.
  useEffect(() => {
    if (!running) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  async function handleFile(file: File) {
    setParseError("");
    setFileName(file.name);
    setFileBytes(file.size);
    try {
      const text = await readFileAsText(file);
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setParseError("Não foi possível ler colunas nesse arquivo.");
        return;
      }
      const limit = checkLimits(file.size, parsed.rows.length);
      if (limit) {
        setParseError(limit);
        return; // nada é carregado: nenhuma linha chega a ser enviada
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(parsed.headers.map((h) => guessMapping(h, IMPORTABLE_LEAD_FIELDS)));
    } catch {
      setParseError("Não foi possível ler esse arquivo como CSV.");
    }
  }

  const resumePrefix = `gsm.leadImport.${currentTenantId ?? "-"}.${user?.id ?? "-"}`;
  const signature = signatureOf([
    fileName,
    String(fileBytes),
    String(rows.length),
    pipelineId,
    stageId,
    canAssign && ownerId ? ownerId : (user?.id ?? ""),
    dedupeStrategy,
    ...mapping,
  ]);

  async function start(isResume: boolean) {
    if (!prepared || validCount === 0 || !user) return;
    if (!stages.some((s) => s.id === stageId)) {
      setParseError("Escolha a etapa de entrada dos leads.");
      return;
    }
    setParseError("");
    const owner = canAssign && ownerId ? ownerId : user.id;
    if (!isResume || !importIdRef.current) {
      // Mesma planilha e mesmos parâmetros de uma importação interrompida (inclusive após recarregar
      // a página): reaproveita o identificador. Os lotes já gravados voltam do servidor como
      // repetição (sem gravar de novo), então o relatório sai completo.
      const now = Date.now();
      pruneResume(resumePrefix, now);
      const status = resumeStatus(readResume(resumePrefix, signature), signature, now);
      if (status.kind === "expired") {
        // Já houve uma importação desta planilha cuja proteção (24 h) venceu: o servidor não sabe
        // mais quais lotes gravou. NÃO reenviar sozinho; a pessoa decide (ver painel de aviso).
        setExpired({ startedAt: status.startedAt });
        return;
      }
      if (status.kind === "fresh") {
        importIdRef.current = status.importId;
        startedAtRef.current = status.startedAt;
      } else {
        importIdRef.current = newImportId();
        startedAtRef.current = now;
      }
      setResumed(status.kind === "fresh");
      doneBatches.current = new Map();
    } else if (!isWithinSafeWindow(startedAtRef.current, Date.now())) {
      // "Retomar" na mesma janela do navegador, mas já passou da janela segura.
      setExpired({ startedAt: startedAtRef.current });
      return;
    }
    const importId = importIdRef.current!;
    // O início é gravado UMA vez (retomar não renova a janela).
    if (!readResume(resumePrefix, signature)) {
      writeResume(resumePrefix, { sig: signature, importId, startedAt: startedAtRef.current });
    }
    setExpired(null);
    cancelRef.current = false;
    setPhase("running");
    setResult(null);

    const outcome = await runImport({
      batches,
      importId,
      done: doneBatches.current,
      send: (batchRows, key) => bulkImport(batchRows, pipelineId, stageId, owner, dedupeStrategy, key),
      onProgress: (p) => {
        if (mounted.current) setProgress(p);
      },
      isCancelled: () => cancelRef.current,
      ...(retrySleep ? { sleep: retrySleep } : {}),
    });
    doneBatches.current = outcome.results;
    const report = buildReport(prepared, batches, outcome);
    const state = finalState(outcome, report);
    // Terminou sem interrupção: a próxima importação desta planilha é uma NOVA (não repete a chave).
    if (outcome.state === "completed") clearResume(resumePrefix, signature);
    if (!mounted.current) return;
    setResult({ state, report, outcome });
    setPhase("done");
  }

  /** Depois que a proteção venceu: recomeça do zero, SEM reaproveitar chaves vencidas e sem "duplicar". */
  function prepareFreshImport() {
    clearResume(resumePrefix, signature);
    importIdRef.current = null;
    startedAtRef.current = 0;
    doneBatches.current = new Map();
    if (dedupeStrategy === "duplicate") setDedupeStrategy("skip");
    setResumed(false);
    setExpired(null);
    setResult(null);
    setProgress(null);
    setPhase("setup");
  }

  function handleClose() {
    // Se algo já foi gravado, o quadro precisa recarregar mesmo sem clicar em "Ver no pipeline".
    if (result && (result.report.counts.created > 0 || result.report.counts.updated > 0)) onImported();
    onClose();
  }

  function handleFinish() {
    onImported();
    onClose();
  }

  const counts = result?.report.counts;
  const problemRows = result ? result.report.rows.filter((r) => r.kind !== "created" && r.kind !== "updated") : [];
  const canRetry = result && (result.state === "failed" || result.state === "cancelled");

  return (
    // IMP-01: diálogo acessível compartilhado (papel, nome, foco preso/devolvido, Esc, proteção de dados).
    // Durante o envio o fechamento fica bloqueado, como no ConfirmDialog.
    <Modal
      title="Importar leads via CSV"
      subtitle="Suba a planilha, relacione cada coluna com um campo do lead (de/para) e escolha o que fazer quando o telefone já existir cadastrado."
      onClose={running ? () => undefined : handleClose}
    >
      {phase === "running" && progress && (
        <div className={styles.summary}>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            Estado: {STATE_LABEL[progress.state]}
          </p>
          <progress
            aria-label="Progresso da importação"
            max={progress.validRows}
            value={progress.processed}
            style={{ width: "100%" }}
          />
          <p role="status" style={{ margin: "8px 0", fontSize: 13 }}>
            {progress.currentBatch !== null
              ? `Enviando lote ${progress.currentBatch} de ${progress.batchesTotal}${progress.attempt > 1 ? ` (nova tentativa ${progress.attempt})` : ""}… `
              : "Aguardando o próximo lote… "}
            {fmt(progress.processed)} de {fmt(progress.validRows)} linhas processadas.
          </p>
          <div className={styles.summaryStats}>
            <span>
              Criados: <strong>{fmt(progress.created)}</strong>
            </span>
            <span>
              Atualizados: <strong>{fmt(progress.updated)}</strong>
            </span>
            <span>
              Ignorados: <strong>{fmt(progress.skipped)}</strong>
            </span>
            <span>
              Com erro: <strong>{fmt(progress.errors)}</strong>
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted, inherit)" }}>
            Mantenha esta janela aberta até terminar. Cancelar interrompe depois do lote em andamento; o que já foi
            gravado permanece.
          </p>
        </div>
      )}

      {phase === "done" && result && counts && (
        <div className={styles.summary}>
          <p role="status" style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {STATE_LABEL[result.state]}
          </p>
          {resumed && (
            <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>
              Esta planilha retomou uma importação interrompida (iniciada em {dateTime(startedAtRef.current)},
              dentro da janela de proteção de 24 h): o servidor reconhece os lotes já gravados e não os
              grava de novo.
            </p>
          )}
          <div className={styles.summaryStats}>
            <span>
              Linhas no arquivo: <strong>{fmt(prepared?.totalRows ?? 0)}</strong>
            </span>
            <span>
              Criados: <strong>{fmt(counts.created)}</strong>
            </span>
            <span>
              Atualizados: <strong>{fmt(counts.updated)}</strong>
            </span>
            <span>
              Duplicados ignorados: <strong>{fmt(counts.duplicate)}</strong>
            </span>
            <span>
              Sem permissão: <strong>{fmt(counts.permission)}</strong>
            </span>
            <span>
              Falha de validação: <strong>{fmt(counts.validation)}</strong>
            </span>
            <span>
              Não confirmadas: <strong>{fmt(counts.processing + counts.unprocessed)}</strong>
            </span>
          </div>
          {result.outcome.failure && (
            <p role="alert" style={{ color: "var(--tone-red)", fontSize: 12.5 }}>
              {describeError(result.outcome.failure.error, "Não foi possível importar.")} A importação parou no lote{" "}
              {result.outcome.failure.batchIndex + 1} de {batches.length}. Os lotes anteriores foram gravados; use
              “Retomar importação” para continuar sem duplicar.
            </p>
          )}
          {problemRows.length > 0 && (
            <>
              <div className={styles.errorList} aria-label="Linhas que precisam de atenção">
                {problemRows.slice(0, REPORT_ROWS_SHOWN).map((r) => (
                  <div key={`${r.rowNumber}-${r.kind}`} className={styles.errorRow}>
                    Linha {r.rowNumber} ({r.name || "sem nome"}) — {KIND_LABEL[r.kind]}
                    {r.detail ? `: ${r.detail}` : ""}
                  </div>
                ))}
              </div>
              {problemRows.length > REPORT_ROWS_SHOWN && (
                <p style={{ fontSize: 12.5 }}>
                  Mostrando {REPORT_ROWS_SHOWN} de {fmt(problemRows.length)}. Baixe o relatório para ver todas.
                </p>
              )}
              <Button onClick={() => downloadCsv("relatorio-importacao.csv", reportToCsv(result.report))}>
                Baixar relatório (CSV)
              </Button>
            </>
          )}
        </div>
      )}

      {phase === "setup" && (
        <>
          {headers.length === 0 ? (
            <div className={styles.dropzone}>
              {fileName && !parseError ? `Lendo ${fileName}…` : "Selecione um arquivo .csv exportado da sua planilha"}
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
              <p style={{ fontSize: 12, margin: "8px 0 0" }}>
                Até {fmt(MAX_IMPORT_ROWS)} linhas e 5 MB por arquivo; o envio é feito em lotes de {BATCH_SIZE}.
              </p>
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

              {prepared && (
                <section aria-label="Pré-importação" className={styles.summary} style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Pré-importação: {fileName}</p>
                  <div className={styles.summaryStats}>
                    <span>
                      Linhas: <strong>{fmt(prepared.totalRows)}</strong>
                    </span>
                    <span>
                      Válidas: <strong>{fmt(validCount)}</strong>
                    </span>
                    <span>
                      Inválidas: <strong>{fmt(prepared.invalid.length)}</strong>
                    </span>
                    <span>
                      Lotes: <strong>{fmt(batches.length)}</strong>
                    </span>
                  </div>
                  {prepared.invalid.length > 0 && prepared.nameMapped && (
                    <p style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                      {fmt(prepared.invalid.length)} linha(s) não serão enviadas e aparecerão no relatório com o motivo
                      (ex.: linha {prepared.invalid[0]!.rowNumber}: {prepared.invalid[0]!.detail})
                    </p>
                  )}
                  {prepared.warnings.unknownOrigin > 0 && (
                    <p style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--tone-amber)" }}>
                      {fmt(prepared.warnings.unknownOrigin)} linha(s) com origem desconhecida: os leads serão criados sem
                      origem.
                    </p>
                  )}
                  {prepared.warnings.shortPhone > 0 && (
                    <p style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--tone-amber)" }}>
                      {fmt(prepared.warnings.shortPhone)} linha(s) com telefone curto (menos de 10 dígitos): não
                      detectam duplicados por telefone.
                    </p>
                  )}
                  <p style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                    “Válida” significa apenas que passou nas checagens do navegador; o servidor ainda pode ignorar
                    duplicados ou recusar linhas, e tudo aparece no relatório final.
                  </p>
                </section>
              )}
            </>
          )}
          {parseError && (
            <p role="alert" style={{ color: "var(--tone-red)", fontSize: 12.5 }}>
              {parseError}
            </p>
          )}
        </>
      )}

      {blockedReason && phase === "setup" && (
        <p id={`${uid}-blocked`} role="status" style={{ color: "var(--tone-amber)", fontSize: 12.5 }}>
          {blockedReason}
        </p>
      )}

      {expired && (
        <div role="alert" className={styles.summary} style={{ borderColor: "var(--tone-amber)" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>A proteção contra duplicação desta importação venceu</p>
          <p style={{ margin: "0 0 8px", fontSize: 12.5 }}>
            Esta planilha foi enviada pela primeira vez em {dateTime(expired.startedAt)}. O servidor só guarda
            o registro dos lotes por 24 h, então não é seguro reenviá-los: alguns ou todos os leads desta
            planilha podem já ter sido importados. <strong>Nada foi reenviado.</strong>
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12.5 }}>
            Para continuar, prepare uma nova importação: telefones já cadastrados serão tratados pela
            estratégia escolhida{dedupeStrategy === "duplicate" ? " (que será trocada para “Ignorar a linha”)" : ""}.
          </p>
          <Button onClick={prepareFreshImport}>Preparar nova importação</Button>
        </div>
      )}

      <div className={styles.modalActions}>
        {running ? (
          <Button
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Cancelar importação
          </Button>
        ) : (
          <Button onClick={phase === "done" ? handleClose : onClose}>{phase === "done" ? "Fechar" : "Cancelar"}</Button>
        )}
        {phase === "done" ? (
          <>
            {canRetry && (
              <Button onClick={() => void start(true)}>Retomar importação</Button>
            )}
            <Button variant="primary" onClick={handleFinish}>
              Ver no pipeline
            </Button>
          </>
        ) : (
          phase === "setup" && (
            <Button
              variant="primary"
              onClick={() => void start(false)}
              disabled={validCount === 0}
              aria-describedby={blockedReason ? `${uid}-blocked` : undefined}
            >
              {`Importar ${validCount || ""} lead(s)`}
            </Button>
          )
        )}
      </div>
    </Modal>
  );
}
