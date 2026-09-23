import { useNavigate } from "react-router-dom";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { ROUTES } from "../constants/routes";
import { useSdrProspectingQueue } from "../hooks/useSdrProspectingQueue";
import { useToast } from "../hooks/useToast";
import {
  SDR_OUTREACH_CHANNEL_LABEL,
  SDR_PRIORITY_LABEL,
  type SdrPriority,
  type SdrProspectSdrContext,
} from "../types/sdr";
import { toWhatsappPhone } from "../utils/phone";
import styles from "./SdrPages.module.css";

const PRIORITY_COLOR: Record<SdrPriority, { color: string; bg: string }> = {
  a: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  b: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  c: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

function whatsappUrl(phoneRaw: string, message: string): string {
  const digits = toWhatsappPhone(phoneRaw);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function SdrProspectingQueuePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: items, loading, error } = useSdrProspectingQueue();

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
    toast("Mensagem copiada");
  }

  return (
    <div>
      <SdrSubNav />
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Prospectar hoje</h1>
          <p className={styles.pageSubtitle}>
            Prospects em "A prospectar" ainda sem primeiro contato — ordenados pelo Score GSM.
            Abrir o WhatsApp não conta como contato: confirme no Prospect depois de enviar.
          </p>
        </div>
      </div>

      {loading && <div className={styles.empty}>Carregando…</div>}
      {error && <EmptyState title="Não foi possível carregar a fila" message={error.message} />}
      {!loading && !error && items && items.length === 0 && (
        <EmptyState
          title="Nada pra prospectar agora"
          message='Todos os prospects em "A prospectar" já têm o primeiro contato confirmado.'
        />
      )}

      {items?.map((item: SdrProspectSdrContext) => (
        <div key={item.prospectId} className={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2 className={styles.cardTitle}>{item.companyName}</h2>
            {item.scorePriority && (
              <Badge
                label={`Score ${item.scoreTotal}/100 — ${SDR_PRIORITY_LABEL[item.scorePriority]}`}
                {...PRIORITY_COLOR[item.scorePriority]}
              />
            )}
          </div>
          <p className={styles.pageSubtitle}>
            {[item.niche, item.city].filter(Boolean).join(" · ") || "—"}
          </p>

          {item.outreachOpportunities && item.outreachOpportunities.length > 0 && (
            <p className={styles.pageSubtitle}>
              <strong>Oportunidade:</strong> {item.outreachOpportunities.join("; ")}
            </p>
          )}
          {item.outreachHook && (
            <p className={styles.pageSubtitle}>
              <strong>Gancho:</strong> {item.outreachHook}
            </p>
          )}
          {item.outreachMessage && (
            <p className={styles.pageSubtitle}>
              <strong>Mensagem sugerida{item.outreachChannel && (
                <> ({SDR_OUTREACH_CHANNEL_LABEL[item.outreachChannel]})</>
              )}:</strong>{" "}
              {item.outreachMessage}
            </p>
          )}
          {!item.candidateId && (
            <p className={styles.pageSubtitle}>
              Sem análise de IA ainda — calcule o Score/gere a abordagem no Candidate de origem.
            </p>
          )}

          <div className={styles.modalActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            {item.phoneRaw && item.outreachMessage && (
              <a
                href={whatsappUrl(item.phoneRaw, item.outreachMessage)}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="primary">Abrir WhatsApp</Button>
              </a>
            )}
            {item.outreachMessage && (
              <Button onClick={() => handleCopy(item.outreachMessage ?? "")}>Copiar mensagem</Button>
            )}
            {item.candidateId && (
              <Button onClick={() => navigate(ROUTES.sdrCandidateDetail(item.candidateId ?? ""))}>
                Ver análise completa
              </Button>
            )}
            <Button onClick={() => navigate(ROUTES.pipeline)}>Abrir no funil (confirmar contato)</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
