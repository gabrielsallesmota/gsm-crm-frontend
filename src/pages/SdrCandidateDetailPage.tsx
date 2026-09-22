import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { useSdrCandidate } from "../hooks/useSdrCandidate";
import { useSdrCandidateActions } from "../hooks/useSdrCandidateActions";
import { useSdrCandidateAppearances, useSdrCandidateDecisions } from "../hooks/useSdrCandidateHistory";
import { useSdrDiscardReasons } from "../hooks/useSdrDiscardReasons";
import { useToast } from "../hooks/useToast";
import {
  SDR_CANDIDATE_STATUS_LABEL,
  SDR_DECISION_LABEL,
  type SdrCandidateStatus,
} from "../types/sdr";
import styles from "./SdrPages.module.css";

const STATUS_COLOR: Record<SdrCandidateStatus, { color: string; bg: string }> = {
  novo: { color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  em_revisao: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  aprovado: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  descartado: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

export function SdrCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: candidate, loading, error, reload } = useSdrCandidate(id ?? "");
  const { data: decisions, reload: reloadDecisions } = useSdrCandidateDecisions(id ?? "");
  const { data: appearances } = useSdrCandidateAppearances(id ?? "");
  const { data: discardReasons } = useSdrDiscardReasons();
  const { review, approve, discard, reevaluate } = useSdrCandidateActions();

  const [notes, setNotes] = useState("");
  const [discardReasonId, setDiscardReasonId] = useState("");
  const [busy, setBusy] = useState(false);

  function refreshAll() {
    reload();
    reloadDecisions();
  }

  async function handleReview() {
    if (!id) return;
    setBusy(true);
    try {
      await review(id, notes || undefined);
      setNotes("");
      toast("Candidate marcado em revisão");
      refreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível revisar");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!id) return;
    setBusy(true);
    try {
      // Fica na própria página (o card "Aprovado" abaixo já mostra o
      // vínculo) — sem navegação automática pra não perder o contexto.
      await approve(id);
      toast('Candidate aprovado — Prospect criado em "A prospectar"');
      refreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível aprovar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    if (!id || !discardReasonId) return;
    setBusy(true);
    try {
      await discard(id, discardReasonId, notes || undefined);
      setNotes("");
      setDiscardReasonId("");
      toast("Candidate descartado");
      refreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível descartar");
    } finally {
      setBusy(false);
    }
  }

  async function handleReevaluate() {
    if (!id) return;
    setBusy(true);
    try {
      await reevaluate(id, notes || undefined);
      setNotes("");
      toast("Candidate liberado pra reavaliação");
      refreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível reavaliar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className={styles.empty}>Carregando…</div>;
  if (error || !candidate) {
    return (
      <EmptyState
        title="Candidate não encontrado"
        message={error?.message ?? "Ele pode ter sido removido."}
      />
    );
  }

  const isDuplicate = Boolean(candidate.knownDuplicateProspectId ?? candidate.knownDuplicateClientId);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <Button onClick={() => navigate(ROUTES.sdrCandidates)}>‹ Voltar</Button>
          <h1 className={styles.pageTitle} style={{ marginTop: 8 }}>
            {candidate.companyName}
          </h1>
          <p className={styles.pageSubtitle}>
            <Badge
              label={SDR_CANDIDATE_STATUS_LABEL[candidate.status]}
              {...STATUS_COLOR[candidate.status]}
            />
          </p>
        </div>
      </div>

      {isDuplicate && (
        <div className={styles.duplicateWarning}>
          Esta empresa já é um {candidate.knownDuplicateProspectId ? "Prospect" : "Cliente"}{" "}
          conhecido — não é possível aprovar (criaria um lead duplicado). Descarte como duplicado
          em vez de aprovar.
        </div>
      )}

      {candidate.approvedProspectId && (
        <div className={styles.card}>
          Aprovado — virou Prospect (id <code>{candidate.approvedProspectId}</code>), estágio "A
          prospectar", sem contato ainda registrado.
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Identidade</h2>
        <p className={styles.pageSubtitle}>Telefone: {candidate.phoneRaw ?? "—"}</p>
        <p className={styles.pageSubtitle}>Nicho: {candidate.niche ?? "—"}</p>
        <p className={styles.pageSubtitle}>
          Localidade:{" "}
          {[candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || "—"}
        </p>
        {candidate.googleMapsUrl && (
          <p className={styles.pageSubtitle}>
            <a href={candidate.googleMapsUrl} target="_blank" rel="noreferrer">
              Ver no Google Maps
            </a>
          </p>
        )}
      </div>

      {candidate.status !== "aprovado" && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Triagem</h2>
          <label className={styles.fieldLabel} htmlFor="candidate-triage-notes">
            Notas (opcional)
          </label>
          <textarea
            id="candidate-triage-notes"
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className={styles.modalActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <Button onClick={() => void handleReview()} disabled={busy}>
              Marcar em revisão
            </Button>
            {candidate.status === "descartado" ? (
              <Button onClick={() => void handleReevaluate()} disabled={busy}>
                Reavaliar
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={() => void handleApprove()}
                  disabled={busy || isDuplicate}
                  title={isDuplicate ? "Já é um Prospect/Cliente conhecido" : undefined}
                >
                  Aprovar
                </Button>
                <select
                  className={styles.select}
                  value={discardReasonId}
                  onChange={(e) => setDiscardReasonId(e.target.value)}
                >
                  <option value="">Motivo de descarte…</option>
                  {(discardReasons ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="danger"
                  onClick={() => void handleDiscard()}
                  disabled={busy || !discardReasonId}
                >
                  Descartar
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Aparições em campanhas</h2>
        {appearances && appearances.length > 0 ? (
          appearances.map((a) => (
            <div key={a.id} className={styles.historyItem}>
              Campanha <code>{a.campaignId}</code> — visto {a.timesSeen}x
              <div className={styles.historyMeta}>
                1ª vez em {fmtDateTime(a.firstSeenAt)}, última em {fmtDateTime(a.lastSeenAt)}
              </div>
            </div>
          ))
        ) : (
          <p className={styles.pageSubtitle}>Nenhuma aparição registrada ainda.</p>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Histórico de decisões</h2>
        {decisions && decisions.length > 0 ? (
          decisions.map((d) => (
            <div key={d.id} className={styles.historyItem}>
              {SDR_DECISION_LABEL[d.decision]}
              {d.notes && <> — {d.notes}</>}
              <div className={styles.historyMeta}>{fmtDateTime(d.createdAt)}</div>
            </div>
          ))
        ) : (
          <p className={styles.pageSubtitle}>Nenhuma decisão registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
