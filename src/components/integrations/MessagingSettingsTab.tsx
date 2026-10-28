import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useToast } from "../../hooks/useToast";
import { messagingSettingsService } from "../../services/MessagingService";
import { RETENTION_OPTIONS, type MessagingSettings } from "../../utils/messaging";
import styles from "./Integrations.module.css";

/**
 * Configurações → Integrações → Conversas (só Admin): por quanto tempo as mensagens ficam no CRM
 * (6 a 12 meses; a limpeza roda todo dia 1º) e se o Instagram cria lead sozinho.
 */
export function MessagingSettingsTab({ readOnly, instagram }: { readOnly: boolean; instagram: boolean }) {
  const { data, loading, error, reload } = useAsyncResource(() => messagingSettingsService.get(), []);
  const { toast, toastError } = useToast();
  const [draft, setDraft] = useState<MessagingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      setDraft(await messagingSettingsService.save(draft));
      toast("Configurações das conversas salvas.");
    } catch (err) {
      toastError(err, "Não foi possível salvar.");
      reload();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) return <SkeletonRows rows={2} label="Carregando as configurações" />;
  if (error) {
    return (
      <EmptyState title="Não foi possível carregar" message={error.message} action={{ label: "Tentar de novo", onClick: reload }} />
    );
  }
  if (!draft) return null;
  const changed =
    data !== null &&
    (draft.retentionMonths !== data.retentionMonths ||
      draft.instagramAutoCreateLeads !== data.instagramAutoCreateLeads);

  return (
    <section className={styles.panel} aria-label="Conversas">
      <h2 className={styles.panelTitle}>Conversas</h2>
      <label className={styles.field}>
        <span>Guardar as mensagens por</span>
        <select
          value={draft.retentionMonths}
          disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, retentionMonths: Number(e.target.value) })}
        >
          {RETENTION_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} meses
            </option>
          ))}
        </select>
      </label>
      <p className={styles.muted}>
        Todo dia 1º do mês o CRM apaga as mensagens mais antigas que isso. Os leads, a timeline e o histórico comercial
        continuam.
      </p>
      {instagram && (
        <label className={styles.checkItem}>
          <input
            type="checkbox"
            checked={draft.instagramAutoCreateLeads}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, instagramAutoCreateLeads: e.target.checked })}
          />
          <span>Criar lead automaticamente quando alguém novo mandar Direct no Instagram</span>
        </label>
      )}
      <div className={styles.rowActions}>
        <Button variant="primary" onClick={() => void save()} disabled={!changed || saving || readOnly}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}
