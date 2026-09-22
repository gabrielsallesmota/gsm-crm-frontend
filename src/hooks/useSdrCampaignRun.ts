import { useCallback, useEffect, useRef, useState } from "react";
import { sdrService } from "../services/SdrService";
import { SDR_RUN_TERMINAL_STATUSES, type SdrCampaignRun } from "../types/sdr";

const POLL_MS = 3000;

export interface SdrCampaignRunPanel {
  run: SdrCampaignRun | null;
  loading: boolean;
  error: Error | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  reprocessFailed: () => Promise<number>;
}

/** Polling simples e robusto (setInterval, ~3s) — pedido explícito do
 * usuário: "não introduza WebSocket sem necessidade demonstrada". Mais
 * simples que `useTerapeutaDaVezPanel`: sem o timer de "próxima transição
 * conhecida" (não dá pra prever quando um job de garimpo termina, ao
 * contrário de um atendimento com horário previsto). Para sozinho quando o
 * run chega num status terminal — sem gastar polling num run que já
 * acabou. */
export function useSdrCampaignRun(runId: string | null): SdrCampaignRunPanel {
  const [run, setRun] = useState<SdrCampaignRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    if (!runId) return;
    try {
      const next = await sdrService.getCampaignRun(runId);
      if (mounted.current) {
        setRun(next);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setLoading(false);
      return;
    }
    mounted.current = true;
    setLoading(true);
    void poll();
    const pollId = setInterval(() => {
      setRun((current) => {
        if (current && SDR_RUN_TERMINAL_STATUSES.has(current.status)) {
          clearInterval(pollId);
          return current;
        }
        void poll();
        return current;
      });
    }, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(pollId);
    };
  }, [runId, poll]);

  async function pause() {
    if (!runId) return;
    setRun(await sdrService.pauseCampaignRun(runId));
  }

  async function resume() {
    if (!runId) return;
    setRun(await sdrService.resumeCampaignRun(runId));
  }

  async function cancel() {
    if (!runId) return;
    setRun(await sdrService.cancelCampaignRun(runId));
  }

  async function reprocessFailed() {
    if (!runId) return 0;
    const result = await sdrService.reprocessFailedJobs(runId);
    await poll();
    return result.reprocessed;
  }

  return { run, loading, error, pause, resume, cancel, reprocessFailed };
}
