import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Modal } from "../common/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useLeadActions } from "../../hooks/useLeadActions";
import { parseCsv, readFileAsText } from "../../utils/csv";
import { ORIGIN_KEYS } from "../../constants/origins";
import { IMPORTABLE_LEAD_FIELDS, type DedupeStrategy } from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { can } from "../../auth/permissions";
import {
  BATCH_SIZE,
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
import { ImportStepper, type WizardStep } from "./import/ImportStepper";
import { StepColumns } from "./import/StepColumns";
import { StepFile } from "./import/StepFile";
import { StepProgress } from "./import/StepProgress";
import { StepResult } from "./import/StepResult";
import { dateTime } from "./import/format";
import { StepReview } from "./import/StepReview";
import wizard from "./import/ImportWizard.module.css";

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
  const [reading, setReading] = useState(false);
  // Passo dentro da configuração (depois do arquivo lido): colunas → revisão.
  const [setupStep, setSetupStep] = useState<"columns" | "review">("columns");
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);

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
    setReading(true);
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
      setSetupStep("columns");
    } catch {
      setParseError("Não foi possível ler esse arquivo como CSV.");
    } finally {
      setReading(false);
    }
  }

  /** Volta à escolha do arquivo (nada foi enviado nessa fase). */
  function backToFile() {
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setParseError("");
    setFileName("");
    setFileBytes(0);
    setSetupStep("columns");
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
    setStopping(false);
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
    setStopping(false);
    setSetupStep("review");
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

  const step: WizardStep =
    phase === "running"
      ? "importing"
      : phase === "done"
        ? "result"
        : headers.length === 0
          ? "file"
          : setupStep;
  const canRetry = result && (result.state === "failed" || result.state === "cancelled");
  const settingsError = parseError && step !== "file" ? parseError : "";

  return (
    // IMP-01: diálogo acessível compartilhado (papel, nome, foco preso/devolvido, Esc, proteção de dados).
    // Durante o envio o fechamento fica bloqueado, como no ConfirmDialog.
    <Modal
      title="Importar leads via CSV"
      subtitle="Importe uma planilha em 5 passos. Nada é enviado ao servidor até você confirmar a revisão; telefones já cadastrados seguem a estratégia que você escolher."
      size="wide"
      onClose={running ? () => undefined : handleClose}
    >
      <ImportStepper current={step} />

      {step === "file" && (
        <StepFile
          fileName={fileName}
          fileBytes={fileBytes}
          reading={reading}
          error={parseError}
          onFile={(f) => void handleFile(f)}
        />
      )}

      {step === "columns" && prepared && (
        <StepColumns
          fileName={fileName}
          fileBytes={fileBytes}
          headers={headers}
          rows={rows}
          mapping={mapping}
          nameMapped={prepared.nameMapped}
          onMap={(colIndex, field) =>
            setMapping((m) => {
              const next = [...m];
              next[colIndex] = field;
              return next;
            })
          }
        />
      )}

      {step === "review" && prepared && (
        <StepReview
          fileName={fileName}
          prepared={prepared}
          batchCount={batches.length}
          headers={headers}
          mapping={mapping}
          stages={stages}
          stageId={stageId}
          onStage={setStageId}
          canAssign={canAssign}
          team={team}
          ownerId={ownerId}
          onOwner={setOwnerId}
          currentUserId={user?.id}
          dedupe={dedupeStrategy}
          onDedupe={setDedupeStrategy}
          blockedReason={blockedReason}
          blockedId={`${uid}-blocked`}
        />
      )}

      {settingsError && (
        <p role="alert" className={`${wizard.note} ${wizard.error}`}>
          {settingsError}
        </p>
      )}

      {step === "importing" && <StepProgress progress={progress} stopping={stopping} />}

      {step === "result" && result && (
        <StepResult
          state={result.state}
          report={result.report}
          outcome={result.outcome}
          totalRows={prepared?.totalRows ?? 0}
          batchesTotal={batches.length}
          resumed={resumed}
          startedAt={startedAtRef.current}
          now={Date.now()}
          onDownload={() => downloadCsv("relatorio-importacao.csv", reportToCsv(result.report))}
        />
      )}

      {expired && (
        <div role="alert" className={wizard.callout}>
          <p className={wizard.summaryTitle}>A proteção contra duplicação desta importação venceu</p>
          <p className={wizard.note}>
            Esta planilha foi enviada pela primeira vez em {dateTime(expired.startedAt)}. O servidor só guarda o
            registro dos lotes por 24 h, então não é seguro reenviá-los: alguns ou todos os leads desta planilha
            podem já ter sido importados. <strong>Nada foi reenviado.</strong>
          </p>
          <p className={wizard.note}>
            Para continuar, prepare uma nova importação: telefones já cadastrados serão tratados pela estratégia
            escolhida
            {dedupeStrategy === "duplicate" ? " (que será trocada para “Ignorar a linha”)" : ""}.
          </p>
          <Button onClick={prepareFreshImport}>Preparar nova importação</Button>
        </div>
      )}

      <div className={wizard.actions}>
        {running ? (
          <Button className={wizard.actionsLeft} onClick={() => setConfirmStop(true)} disabled={stopping}>
            {stopping ? "Interrompendo…" : "Interromper importação"}
          </Button>
        ) : (
          <Button className={wizard.actionsLeft} onClick={phase === "done" ? handleClose : onClose}>
            {phase === "done" ? "Fechar" : "Cancelar"}
          </Button>
        )}
        {step === "columns" && (
          <>
            <Button onClick={backToFile}>Voltar</Button>
            <Button variant="primary" onClick={() => setSetupStep("review")} disabled={!prepared?.nameMapped}>
              Continuar
            </Button>
          </>
        )}
        {step === "review" && (
          <>
            <Button onClick={() => setSetupStep("columns")}>Voltar</Button>
            <Button
              variant="primary"
              onClick={() => void start(false)}
              disabled={validCount === 0}
              aria-describedby={blockedReason ? `${uid}-blocked` : undefined}
            >
              {`Importar ${validCount || ""} lead(s)`}
            </Button>
          </>
        )}
        {step === "result" && (
          <>
            {canRetry && <Button onClick={() => void start(true)}>Retomar importação</Button>}
            <Button variant="primary" onClick={handleFinish}>
              Ver no pipeline
            </Button>
          </>
        )}
      </div>

      {confirmStop && (
        <ConfirmDialog
          title="Interromper a importação?"
          message="A importação para depois do lote em andamento. O que já foi gravado permanece no CRM (não é desfeito) e você poderá retomar de onde parou dentro da janela segura de 20 h."
          confirmLabel="Interromper"
          onConfirm={async () => {
            cancelRef.current = true;
            setStopping(true);
            return true;
          }}
          onClose={() => setConfirmStop(false)}
        />
      )}
    </Modal>
  );
}
