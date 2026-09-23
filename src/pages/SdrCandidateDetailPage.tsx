import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { EnrichmentSourceBadge } from "../components/common/EnrichmentSourceBadge";
import { ROUTES } from "../constants/routes";
import { useSdrAuditActions } from "../hooks/useSdrAuditActions";
import { useSdrCandidate } from "../hooks/useSdrCandidate";
import { useSdrCandidateActions } from "../hooks/useSdrCandidateActions";
import { useSdrCandidateAudits } from "../hooks/useSdrCandidateAudits";
import {
  useSdrCandidateEnrichments,
  useSdrDuplicateSuggestions,
} from "../hooks/useSdrCandidateEnrichment";
import { useSdrCandidateAppearances, useSdrCandidateDecisions } from "../hooks/useSdrCandidateHistory";
import { useSdrCandidateOutreach } from "../hooks/useSdrCandidateOutreach";
import { useSdrCandidateScores } from "../hooks/useSdrCandidateScores";
import { useSdrDiscardReasons } from "../hooks/useSdrDiscardReasons";
import { useSdrEnrichmentActions } from "../hooks/useSdrEnrichmentActions";
import { useToast } from "../hooks/useToast";
import { sdrService } from "../services/SdrService";
import {
  SDR_AUDIT_PAGE_KIND_LABEL,
  SDR_AUDIT_SIGNAL_LABEL,
  SDR_AUDIT_STATUS_LABEL,
  SDR_CANDIDATE_STATUS_LABEL,
  SDR_DECISION_LABEL,
  SDR_DUPLICATE_SIGNAL_LABEL,
  SDR_DUPLICATE_TARGET_TYPE_LABEL,
  SDR_OUTREACH_CHANNEL_LABEL,
  SDR_OUTREACH_STATUS_LABEL,
  SDR_OUTREACH_TONE_LABEL,
  SDR_PERFORMANCE_PROVIDER_LABEL,
  SDR_PRIORITY_LABEL,
  type SdrAuditStatus,
  type SdrCandidateStatus,
  type SdrOutreachChannel,
  type SdrOutreachTone,
  type SdrPerformanceReport,
  type SdrPriority,
} from "../types/sdr";
import { formatCnpj } from "../utils/cnpj";
import styles from "./SdrPages.module.css";

const STATUS_COLOR: Record<SdrCandidateStatus, { color: string; bg: string }> = {
  novo: { color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  em_revisao: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  aprovado: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  descartado: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
};

const AUDIT_STATUS_COLOR: Record<SdrAuditStatus, { color: string; bg: string }> = {
  success: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  partial: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  failed: { color: "var(--tone-red)", bg: "var(--tone-red-bg)" },
  skipped: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

const PRIORITY_COLOR: Record<SdrPriority, { color: string; bg: string }> = {
  a: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  b: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  c: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

// Cada provider de performance devolve um subconjunto diferente destes
// campos (Google PageSpeed só pede a categoria Performance, por custo —
// nunca tem accessibility/best-practices/seo/FCP/Speed Index; Lighthouse
// local tem as 4 categorias) — o grid só renderiza o que veio preenchido,
// nunca mostra "—" pra campo que o provider em questão nunca devolve.
const PERFORMANCE_SCORE_FIELDS: { key: keyof SdrPerformanceReport; label: string }[] = [
  { key: "performance_score", label: "Performance" },
  { key: "accessibility_score", label: "Acessibilidade" },
  { key: "best_practices_score", label: "Boas práticas" },
  { key: "seo_score", label: "SEO" },
];

const PERFORMANCE_METRIC_FIELDS: { key: keyof SdrPerformanceReport; label: string }[] = [
  { key: "first_contentful_paint", label: "First Contentful Paint" },
  { key: "largest_contentful_paint", label: "Largest Contentful Paint" },
  { key: "cumulative_layout_shift", label: "Cumulative Layout Shift" },
  { key: "total_blocking_time", label: "Total Blocking Time" },
  { key: "speed_index", label: "Speed Index" },
];

function fmtSignalValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

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
  const {
    data: enrichments,
    reload: reloadEnrichments,
  } = useSdrCandidateEnrichments(id ?? "");
  const {
    data: duplicateSuggestions,
    reload: reloadDuplicateSuggestions,
  } = useSdrDuplicateSuggestions(id ?? "");
  const { setCnpj, refresh, confirmDuplicate, dismissDuplicate } = useSdrEnrichmentActions();
  const { data: audits, reload: reloadAudits } = useSdrCandidateAudits(id ?? "");
  const { setWebsite, refresh: refreshAudit } = useSdrAuditActions();
  const { data: scores, reload: reloadScores } = useSdrCandidateScores(id ?? "");
  const { data: outreachGenerations, reload: reloadOutreach } = useSdrCandidateOutreach(id ?? "");

  const [notes, setNotes] = useState("");
  const [discardReasonId, setDiscardReasonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);
  const [websiteInput, setWebsiteInput] = useState("");
  const [websiteBusy, setWebsiteBusy] = useState(false);
  const [auditRefreshBusy, setAuditRefreshBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState<SdrOutreachChannel>("whatsapp");
  const [outreachTone, setOutreachTone] = useState<SdrOutreachTone>("standard");
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [editedMessage, setEditedMessage] = useState<string | null>(null);

  function refreshAll() {
    reload();
    reloadDecisions();
  }

  function refreshEnrichment() {
    reload();
    reloadEnrichments();
    reloadDuplicateSuggestions();
  }

  async function handleSetWebsite() {
    if (!id || !websiteInput.trim()) return;
    setWebsiteBusy(true);
    try {
      await setWebsite(id, websiteInput.trim());
      setWebsiteInput("");
      toast("Site salvo — auditoria enfileirada");
      reload();
      reloadAudits();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o site");
    } finally {
      setWebsiteBusy(false);
    }
  }

  async function handleRefreshAudit() {
    if (!id) return;
    setAuditRefreshBusy(true);
    try {
      await refreshAudit(id, true);
      toast("Auditoria enfileirada");
      reload();
      reloadAudits();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível atualizar a auditoria");
    } finally {
      setAuditRefreshBusy(false);
    }
  }

  async function handleSetCnpj() {
    if (!id || !cnpjInput.trim()) return;
    setCnpjBusy(true);
    try {
      const result = await setCnpj(id, cnpjInput);
      setCnpjInput("");
      toast(
        result.checkDigitsValid
          ? "CNPJ salvo — enriquecimento enfileirado"
          : "CNPJ salvo (dígito verificador não bate — confira a digitação) — enriquecimento enfileirado",
      );
      refreshEnrichment();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o CNPJ");
    } finally {
      setCnpjBusy(false);
    }
  }

  async function handleRefreshEnrichment() {
    if (!id) return;
    setRefreshBusy(true);
    try {
      await refresh(id, true);
      toast("Atualização enfileirada");
      refreshEnrichment();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível atualizar");
    } finally {
      setRefreshBusy(false);
    }
  }

  async function handleComputeScore() {
    if (!id) return;
    setScoreBusy(true);
    try {
      await sdrService.computeCandidateScore(id);
      toast("Score GSM calculado");
      reloadScores();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível calcular o score");
    } finally {
      setScoreBusy(false);
    }
  }

  async function handleGenerateOutreach() {
    if (!id) return;
    setOutreachBusy(true);
    try {
      await sdrService.generateCandidateOutreach(id, outreachChannel, outreachTone);
      toast("Análise comercial enfileirada");
      setEditedMessage(null);
      reloadOutreach();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível gerar a análise comercial");
    } finally {
      setOutreachBusy(false);
    }
  }

  function handleCopyMessage(text: string) {
    void navigator.clipboard.writeText(text);
    toast("Mensagem copiada");
  }

  async function handleConfirmDuplicate(suggestionId: string) {
    if (!id) return;
    setSuggestionBusyId(suggestionId);
    try {
      await confirmDuplicate(id, suggestionId);
      toast("Duplicidade confirmada");
      reloadDuplicateSuggestions();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível confirmar");
    } finally {
      setSuggestionBusyId(null);
    }
  }

  async function handleDismissDuplicate(suggestionId: string) {
    if (!id) return;
    setSuggestionBusyId(suggestionId);
    try {
      await dismissDuplicate(id, suggestionId);
      toast("Sugestão descartada");
      reloadDuplicateSuggestions();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível descartar");
    } finally {
      setSuggestionBusyId(null);
    }
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

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Score GSM</h2>
        {scores && scores.length > 0 ? (
          (() => {
            const latest = scores[0];
            if (!latest) return null;
            return (
              <>
                <p className={styles.pageSubtitle} style={{ fontSize: 18 }}>
                  <strong>
                    Score GSM: {latest.total}/100
                  </strong>{" "}
                  <Badge
                    label={SDR_PRIORITY_LABEL[latest.priority]}
                    {...PRIORITY_COLOR[latest.priority]}
                  />
                </p>
                <p className={styles.pageSubtitle}>
                  Potencial Comercial: {latest.commercialPotential}/40 · Gap Digital:{" "}
                  {latest.digitalGap}/40 · Fit GSM: {latest.gsmFit}/20
                </p>
                <p className={styles.pageSubtitle}>
                  Versão: {latest.ruleSet} — calculado em {fmtDateTime(latest.computedAt)}
                </p>
                <div
                  className={styles.modalActions}
                  style={{ justifyContent: "flex-start", flexWrap: "wrap" }}
                >
                  <Button onClick={() => setShowScoreBreakdown((v) => !v)}>
                    {showScoreBreakdown ? "Ocultar detalhes" : "Por que recebeu essa pontuação?"}
                  </Button>
                  <Button onClick={() => void handleComputeScore()} disabled={scoreBusy}>
                    {scoreBusy ? "Recalculando…" : "Recalcular"}
                  </Button>
                </div>
                {showScoreBreakdown && (
                  <div style={{ marginTop: 12 }}>
                    {latest.breakdown.map((entry) => (
                      <div key={entry.rule} className={styles.historyItem}>
                        {entry.matched ? "✓" : "—"} {entry.description} ({entry.points} pts)
                        <div className={styles.historyMeta}>{entry.evidence}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <>
            <p className={styles.pageSubtitle}>Score ainda não calculado pra este candidate.</p>
            <Button
              variant="primary"
              onClick={() => void handleComputeScore()}
              disabled={scoreBusy}
            >
              {scoreBusy ? "Calculando…" : "Calcular Score GSM"}
            </Button>
          </>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Análise comercial</h2>
        <p className={styles.pageSubtitle}>
          Sugestão gerada por IA a partir dos fatos já coletados — nunca calcula o Score, nunca
          aprova/descarta o candidate e nunca envia mensagem. Decisão final é sempre sua.
        </p>

        <div className={styles.modalActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <select
            className={styles.select}
            value={outreachChannel}
            onChange={(e) => setOutreachChannel(e.target.value as SdrOutreachChannel)}
          >
            {Object.entries(SDR_OUTREACH_CHANNEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={outreachTone}
            onChange={(e) => setOutreachTone(e.target.value as SdrOutreachTone)}
          >
            {Object.entries(SDR_OUTREACH_TONE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="primary" onClick={() => void handleGenerateOutreach()} disabled={outreachBusy}>
            {outreachBusy
              ? "Gerando…"
              : outreachGenerations && outreachGenerations.length > 0
                ? "Regenerar"
                : "Gerar análise comercial"}
          </Button>
        </div>

        {outreachGenerations && outreachGenerations.length > 0 && (
          (() => {
            const latest = outreachGenerations[0];
            if (!latest) return null;
            if (latest.status !== "success" || !latest.analysis) {
              return (
                <p className={styles.pageSubtitle} style={{ marginTop: 12 }}>
                  {SDR_OUTREACH_STATUS_LABEL[latest.status]}
                  {latest.errorDetail && <> — {latest.errorDetail}</>}
                </p>
              );
            }
            const message = editedMessage ?? latest.analysis.initial_message;
            return (
              <div style={{ marginTop: 16 }}>
                {latest.analysis.positive_signals.length > 0 && (
                  <p className={styles.pageSubtitle}>
                    <strong>Pontos positivos:</strong> {latest.analysis.positive_signals.join("; ")}
                  </p>
                )}
                {latest.analysis.opportunities.length > 0 && (
                  <p className={styles.pageSubtitle}>
                    <strong>Oportunidades:</strong> {latest.analysis.opportunities.join("; ")}
                  </p>
                )}
                <p className={styles.pageSubtitle}>
                  <strong>Solução recomendada:</strong> {latest.analysis.recommended_solution}
                </p>
                <p className={styles.pageSubtitle}>
                  <strong>Gancho:</strong> {latest.analysis.commercial_hook}
                </p>

                <label className={styles.fieldLabel} htmlFor="outreach-message">
                  Mensagem sugerida ({SDR_OUTREACH_CHANNEL_LABEL[latest.channel]}) — editável
                </label>
                <textarea
                  id="outreach-message"
                  className={styles.textarea}
                  value={message}
                  onChange={(e) => setEditedMessage(e.target.value)}
                />
                <div
                  className={styles.modalActions}
                  style={{ justifyContent: "flex-start", marginTop: 8 }}
                >
                  <Button onClick={() => handleCopyMessage(message)}>Copiar</Button>
                </div>

                {latest.analysis.alternative_message && (
                  <p className={styles.pageSubtitle} style={{ marginTop: 8 }}>
                    <strong>Abordagem alternativa:</strong> {latest.analysis.alternative_message}
                  </p>
                )}

                <p className={styles.pageSubtitle} style={{ marginTop: 8 }}>
                  {latest.model} · {SDR_OUTREACH_TONE_LABEL[latest.tone]} · gerado em{" "}
                  {fmtDateTime(latest.createdAt)}
                </p>
              </div>
            );
          })()
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Enriquecimento</h2>
        <p className={styles.pageSubtitle}>CNPJ: {candidate.cnpj ?? "— (anexe abaixo pra enriquecer)"}</p>
        {candidate.razaoSocial && (
          <p className={styles.pageSubtitle}>Razão social: {candidate.razaoSocial}</p>
        )}
        {candidate.nomeFantasia && (
          <p className={styles.pageSubtitle}>Nome fantasia: {candidate.nomeFantasia}</p>
        )}
        {candidate.cnae && <p className={styles.pageSubtitle}>CNAE: {candidate.cnae}</p>}
        {candidate.situacaoCadastral && (
          <p className={styles.pageSubtitle}>Situação cadastral: {candidate.situacaoCadastral}</p>
        )}
        {candidate.dataAbertura && (
          <p className={styles.pageSubtitle}>
            Abertura: {new Date(candidate.dataAbertura).toLocaleDateString("pt-BR")}
          </p>
        )}
        {candidate.capitalSocialCents != null && (
          <p className={styles.pageSubtitle}>
            Capital social:{" "}
            {(candidate.capitalSocialCents / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        )}
        {candidate.domain && <p className={styles.pageSubtitle}>Domínio: {candidate.domain}</p>}
        {candidate.email && <p className={styles.pageSubtitle}>E-mail: {candidate.email}</p>}
        {candidate.instagramHandle && (
          <p className={styles.pageSubtitle}>Instagram: @{candidate.instagramHandle}</p>
        )}
        {candidate.lastEnrichmentAt && (
          <p className={styles.pageSubtitle}>
            Última atualização: {fmtDateTime(candidate.lastEnrichmentAt)}
          </p>
        )}

        <label className={styles.fieldLabel} htmlFor="candidate-cnpj-input">
          {candidate.cnpj ? "Corrigir CNPJ" : "Anexar CNPJ"}
        </label>
        <div className={styles.modalActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <input
            id="candidate-cnpj-input"
            className={styles.input}
            style={{ maxWidth: 220 }}
            value={cnpjInput}
            onChange={(e) => setCnpjInput(formatCnpj(e.target.value))}
            placeholder="00.000.000/0001-00"
          />
          <Button
            variant="primary"
            onClick={() => void handleSetCnpj()}
            disabled={cnpjBusy || !cnpjInput.trim()}
          >
            {cnpjBusy ? "Salvando…" : "Salvar CNPJ"}
          </Button>
          {candidate.cnpj && (
            <Button onClick={() => void handleRefreshEnrichment()} disabled={refreshBusy}>
              {refreshBusy ? "Atualizando…" : "Atualizar agora"}
            </Button>
          )}
        </div>

        {enrichments && enrichments.length > 0 && (
          <>
            <p className={styles.fieldLabel} style={{ marginTop: 20 }}>
              Histórico de tentativas
            </p>
            {enrichments.map((e) => (
              <div key={e.id} className={styles.historyItem}>
                <EnrichmentSourceBadge source={e.source} status={e.status} />
                {e.errorDetail && <> — {e.errorDetail}</>}
                <div className={styles.historyMeta}>{fmtDateTime(e.fetchedAt)}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Auditoria do site</h2>
        <p className={styles.pageSubtitle}>
          Site: {candidate.domain ?? "— (anexe abaixo pra auditar)"}
        </p>

        <label className={styles.fieldLabel} htmlFor="candidate-website-input">
          {candidate.domain ? "Corrigir site" : "Anexar site"}
        </label>
        <div className={styles.modalActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <input
            id="candidate-website-input"
            className={styles.input}
            style={{ maxWidth: 260 }}
            value={websiteInput}
            onChange={(e) => setWebsiteInput(e.target.value)}
            placeholder="https://www.empresa.com.br"
          />
          <Button
            variant="primary"
            onClick={() => void handleSetWebsite()}
            disabled={websiteBusy || !websiteInput.trim()}
          >
            {websiteBusy ? "Salvando…" : "Salvar site"}
          </Button>
          {candidate.domain && (
            <Button onClick={() => void handleRefreshAudit()} disabled={auditRefreshBusy}>
              {auditRefreshBusy ? "Atualizando…" : "Atualizar agora"}
            </Button>
          )}
        </div>

        {audits && audits.length > 0 && (
          <>
            {(() => {
              const latest = audits[0];
              if (!latest) return null;
              return (
                <div style={{ marginTop: 20 }}>
                  <Badge
                    label={SDR_AUDIT_STATUS_LABEL[latest.status]}
                    {...AUDIT_STATUS_COLOR[latest.status]}
                  />
                  <p className={styles.pageSubtitle} style={{ marginTop: 8 }}>
                    Última auditoria: {fmtDateTime(latest.finishedAt)} (versão do auditor{" "}
                    {latest.auditorVersion})
                  </p>

                  {Object.keys(latest.signals).length > 0 && (
                    <>
                      <p className={styles.fieldLabel}>Principais sinais</p>
                      {Object.entries(latest.signals).map(([key, signal]) => (
                        <div key={key} className={styles.historyItem}>
                          {SDR_AUDIT_SIGNAL_LABEL[key] ?? key}: {fmtSignalValue(signal.value)}
                          <div className={styles.historyMeta}>{signal.evidence}</div>
                        </div>
                      ))}
                    </>
                  )}

                  <p className={styles.fieldLabel}>Páginas analisadas</p>
                  {latest.pagesChecked.map((p, idx) => (
                    <div key={`${p.url}-${idx}`} className={styles.historyItem}>
                      {SDR_AUDIT_PAGE_KIND_LABEL[p.pageKind] ?? p.pageKind} — {p.url}{" "}
                      {p.ok ? (
                        <Badge label="OK" color="var(--tone-green)" bg="var(--tone-green-bg)" />
                      ) : (
                        <Badge label="Falhou" color="var(--tone-red)" bg="var(--tone-red-bg)" />
                      )}
                      {!p.ok && p.error && <div className={styles.historyMeta}>{p.error}</div>}
                    </div>
                  ))}

                  {latest.pagespeed && (
                    <>
                      <p className={styles.fieldLabel}>
                        Performance
                        {latest.pagespeed.provider && (
                          <span className={styles.historyMeta} style={{ marginLeft: 8 }}>
                            {SDR_PERFORMANCE_PROVIDER_LABEL[latest.pagespeed.provider]}
                          </span>
                        )}
                      </p>
                      <div className={styles.performanceGrid}>
                        {PERFORMANCE_SCORE_FIELDS.map(
                          ({ key, label }) =>
                            latest.pagespeed![key] != null && (
                              <div key={key} className={styles.performanceMetric}>
                                <span className={styles.historyMeta}>{label}</span>
                                <span>{latest.pagespeed![key]}/100</span>
                              </div>
                            ),
                        )}
                        {PERFORMANCE_METRIC_FIELDS.map(
                          ({ key, label }) =>
                            latest.pagespeed![key] != null && (
                              <div key={key} className={styles.performanceMetric}>
                                <span className={styles.historyMeta}>{label}</span>
                                <span>{latest.pagespeed![key]}</span>
                              </div>
                            ),
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <p className={styles.fieldLabel} style={{ marginTop: 20 }}>
              Histórico de auditorias
            </p>
            {audits.map((a) => (
              <div key={a.id} className={styles.historyItem}>
                <Badge label={SDR_AUDIT_STATUS_LABEL[a.status]} {...AUDIT_STATUS_COLOR[a.status]} />
                <div className={styles.historyMeta}>{fmtDateTime(a.finishedAt)}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {duplicateSuggestions && duplicateSuggestions.filter((s) => s.status === "pending").length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Possíveis duplicatas</h2>
          {duplicateSuggestions
            .filter((s) => s.status === "pending")
            .map((s) => (
              <div key={s.id} className={styles.historyItem}>
                {SDR_DUPLICATE_TARGET_TYPE_LABEL[s.targetType]} <code>{s.targetId}</code> — sinal:{" "}
                {SDR_DUPLICATE_SIGNAL_LABEL[s.signal]} ({s.confidence === "strong" ? "forte" : "fraco"})
                <div className={styles.historyMeta}>Detectado em {fmtDateTime(s.detectedAt)}</div>
                <div
                  className={styles.modalActions}
                  style={{ justifyContent: "flex-start", marginTop: 8 }}
                >
                  <Button
                    variant="primary"
                    onClick={() => void handleConfirmDuplicate(s.id)}
                    disabled={suggestionBusyId === s.id}
                  >
                    É a mesma empresa
                  </Button>
                  <Button
                    onClick={() => void handleDismissDuplicate(s.id)}
                    disabled={suggestionBusyId === s.id}
                  >
                    Não é duplicata
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

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
