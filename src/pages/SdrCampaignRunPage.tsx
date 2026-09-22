import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { SdrProgressBar } from "../components/common/SdrProgressBar";
import { ROUTES } from "../constants/routes";
import { useSdrCampaignRun } from "../hooks/useSdrCampaignRun";
import { useSdrRunJobs } from "../hooks/useSdrRunJobs";
import { useToast } from "../hooks/useToast";
import { SDR_RUN_MODE_LABEL, SDR_RUN_STATUS_LABEL, type SdrRunStatus } from "../types/sdr";
import styles from "./SdrPages.module.css";

const STATUS_COLOR: Record<SdrRunStatus, { color: string; bg: string }> = {
  queued: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
  running: { color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  paused: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  completed: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  failed: { color: "var(--tone-red)", bg: "var(--tone-red-bg)" },
  cancelled: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export function SdrCampaignRunPage() {
  const { id: campaignId, runId } = useParams<{ id: string; runId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { run, loading, error, pause, resume, cancel, reprocessFailed } =
    useSdrCampaignRun(runId ?? null);
  const { data: deadJobs } = useSdrRunJobs(runId ?? null, "dead", run?.failureCount ?? 0);
  const [busy, setBusy] = useState(false);

  async function handleAction(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      toast(successMessage);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível completar a ação");
    } finally {
      setBusy(false);
    }
  }

  async function handleReprocess() {
    setBusy(true);
    try {
      const count = await reprocessFailed();
      toast(`${count} falha(s) reenfileirada(s)`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível reprocessar as falhas");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !run) return <div className={styles.empty}>Carregando…</div>;
  if (error || !run) {
    return (
      <EmptyState
        title="Execução não encontrada"
        message={error?.message ?? "Ela pode ter sido removida."}
      />
    );
  }

  const canPause = run.status === "running" || run.status === "queued";
  const canResume = run.status === "paused";
  const canCancel = run.status === "running" || run.status === "paused" || run.status === "queued";
  const canReprocess = (deadJobs?.length ?? 0) > 0;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <Button onClick={() => navigate(ROUTES.sdrCampanhaEditar(campaignId ?? ""))}>
            ‹ Voltar pra campanha
          </Button>
          <h1 className={styles.pageTitle} style={{ marginTop: 8 }}>
            Execução de garimpo
          </h1>
          <p className={styles.pageSubtitle}>
            <Badge label={SDR_RUN_STATUS_LABEL[run.status]} {...STATUS_COLOR[run.status]} /> ·{" "}
            {SDR_RUN_MODE_LABEL[run.mode]}
          </p>
        </div>
        <div className={styles.headerActions}>
          {canPause && (
            <Button
              onClick={() => void handleAction(pause, "Execução pausada")}
              disabled={busy}
            >
              Pausar
            </Button>
          )}
          {canResume && (
            <Button
              variant="primary"
              onClick={() => void handleAction(resume, "Execução retomada")}
              disabled={busy}
            >
              Retomar
            </Button>
          )}
          {canReprocess && (
            <Button onClick={() => void handleReprocess()} disabled={busy}>
              Reprocessar falhas
            </Button>
          )}
          {canCancel && (
            <Button
              variant="danger"
              onClick={() => void handleAction(cancel, "Execução cancelada")}
              disabled={busy}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Progresso</h2>
        <SdrProgressBar processedCount={run.processedCount} targetQuantity={run.targetQuantity} />
        <p className={styles.pageSubtitle} style={{ marginTop: 10 }}>
          {run.currentStage ?? "—"}
        </p>
        <div className={styles.locationRow} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div>
            <span className={styles.fieldLabel} style={{ marginTop: 0 }}>
              Encontrados
            </span>
            {run.foundCount}
          </div>
          <div>
            <span className={styles.fieldLabel} style={{ marginTop: 0 }}>
              Duplicados
            </span>
            {run.duplicateCount}
          </div>
          <div>
            <span className={styles.fieldLabel} style={{ marginTop: 0 }}>
              Processados
            </span>
            {run.processedCount}
          </div>
          <div>
            <span className={styles.fieldLabel} style={{ marginTop: 0 }}>
              Falhas
            </span>
            {run.failureCount}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Linha do tempo</h2>
        <p className={styles.pageSubtitle}>Iniciado em {fmtDateTime(run.startedAt)}</p>
        <p className={styles.pageSubtitle}>Pausado em {fmtDateTime(run.pausedAt)}</p>
        <p className={styles.pageSubtitle}>Finalizado em {fmtDateTime(run.finishedAt)}</p>
        {run.maxProviderCalls !== null && (
          <p className={styles.pageSubtitle}>Teto de chamadas ao provider: {run.maxProviderCalls}</p>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Falhas ({deadJobs?.length ?? 0})</h2>
        {deadJobs && deadJobs.length > 0 ? (
          deadJobs.map((j) => (
            <div key={j.id} className={styles.historyItem}>
              {j.searchTerm} em{" "}
              {[j.city, j.state, j.country, j.locality].filter(Boolean).join(", ") || "—"}
              <div className={styles.historyMeta}>
                {j.lastError ?? "Sem detalhe"} · {j.attempts}/{j.maxAttempts} tentativas
              </div>
            </div>
          ))
        ) : (
          <p className={styles.pageSubtitle}>Nenhuma falha definitiva até agora.</p>
        )}
      </div>
    </div>
  );
}
