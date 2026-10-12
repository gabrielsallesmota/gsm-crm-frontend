import { useCallback, useEffect, useState } from "react";
import { Button } from "../common/Button";
import { SkeletonRows } from "../common/Skeleton";
import { notificationsService } from "../../services/NotificationsService";
import { describeError } from "../../utils/apiErrors";
import { CHANNEL_STATUS_LABELS, NOT_RECEIVING_LABELS } from "../../utils/notifications";
import type { DigestPreview } from "../../types/notifications";
import styles from "./Notifications.module.css";
import integ from "../integrations/Integrations.module.css";

const SECTION_TITLES: Record<string, string> = {
  tasks: "Tarefas",
  leads: "Leads",
  calendar: "Agenda de hoje",
  opportunities: "Oportunidades",
};

function itemLabel(key: string, item: Record<string, unknown>): string {
  if (key === "tasks") return `${item.title} — ${item.lead_name} (${item.due_local})`;
  if (key === "calendar") return `${item.time_local} ${item.title} — ${item.lead_name}`;
  return String(item.name ?? item.title ?? "");
}

/**
 * Prévia do resumo diário. Só LÊ: nenhuma mensagem é enviada, nada é
 * gravado e não há botão "Enviar teste" (o canal só existe no B.8).
 * `recipientUserId` de outra pessoa: só o admin (o backend recusa os demais).
 */
export function PreviewPanel({
  recipientUserId,
  recipientOptions,
  onRecipientChange,
}: {
  recipientUserId?: string | undefined;
  recipientOptions?: { userId: string; name: string }[] | undefined;
  onRecipientChange?: ((userId: string | undefined) => void) | undefined;
}) {
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview(await notificationsService.preview(recipientUserId));
    } catch (err) {
      setPreview(null);
      setError(describeError(err, "Não foi possível montar a prévia."));
    } finally {
      setLoading(false);
    }
  }, [recipientUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="preview-title">
      <h2 id="preview-title" className="sr-only">
        Prévia do resumo
      </h2>
      <p className={`${styles.notice} ${styles.info}`} role="note">
        <strong>Esta é apenas uma prévia. Nenhuma mensagem será enviada.</strong> O envio por
        WhatsApp ainda não está disponível.
      </p>
      <div className={styles.toolbarRow}>
        {recipientOptions && recipientOptions.length > 0 && (
          <label>
            <span className="sr-only">Pré-visualizar para</span>
            <select
              value={recipientUserId ?? ""}
              onChange={(e) => onRecipientChange?.(e.target.value || undefined)}
              aria-label="Pré-visualizar para"
            >
              <option value="">Eu mesmo</option>
              {recipientOptions.map((o) => (
                <option key={o.userId} value={o.userId}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar prévia"}
        </Button>
      </div>
      {loading && !preview && <SkeletonRows rows={4} label="Montando a prévia" />}
      {error && (
        <p className={`${styles.notice} ${styles.danger}`} role="alert">
          {error}
        </p>
      )}
      {preview && (
        <>
          <p className={integ.muted}>
            Para {preview.recipientName} ·{" "}
            {preview.scope === "team" ? "equipe inteira" : "só os dados dele(a)"} · fuso{" "}
            {preview.timezone}
          </p>
          {!preview.receives && preview.notReceivingReason && (
            <p className={`${styles.notice} ${styles.caution}`}>
              Esta pessoa hoje não receberia o resumo:{" "}
              {NOT_RECEIVING_LABELS[preview.notReceivingReason]}.
            </p>
          )}
          <p className={integ.muted}>Canal: {CHANNEL_STATUS_LABELS[preview.channel.status]}</p>
          {preview.empty ? (
            <p className={integ.empty}>Nada pendente para hoje — o resumo ficaria vazio.</p>
          ) : (
            <div className={styles.sectionList}>
              {preview.sections.map((section) => (
                <div key={section.key} className={styles.sectionCard}>
                  <strong>
                    {SECTION_TITLES[section.key] ?? section.key} ({section.total})
                  </strong>
                  {section.total === 0 && <div className={styles.counts}>Nada por aqui.</div>}
                  {section.mode === "count" && (
                    <div className={styles.counts}>Só a quantidade será enviada.</div>
                  )}
                  {section.items.length > 0 && (
                    <ul>
                      {section.items.map((item, index) => (
                        <li key={String(item.id ?? index)}>{itemLabel(section.key, item)}</li>
                      ))}
                    </ul>
                  )}
                  {section.truncated > 0 && (
                    <div className={styles.counts}>… e mais {section.truncated}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <h3 className={integ.panelTitle}>Texto como seria apresentado</h3>
          <pre className={styles.previewText} aria-label="Texto da prévia">
            {preview.text}
          </pre>
        </>
      )}
    </section>
  );
}
