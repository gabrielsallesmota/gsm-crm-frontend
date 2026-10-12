import { useState } from "react";
import { Button } from "../common/Button";
import { connectionsService } from "../../services/ConnectionsService";
import { describeError } from "../../utils/apiErrors";
import { PROVIDER_LABEL } from "../../utils/connections";
import type { CompanyPolicy } from "../../types/connections";
import styles from "./Connections.module.css";

/**
 * Só o administrador decide quais provedores a empresa permite. Bloquear um
 * provedor impede NOVAS conexões e pausa a sincronização das existentes; os
 * itens já importados continuam no CRM.
 */
export function CompanyPolicyPanel({
  policy,
  onSaved,
}: {
  policy: CompanyPolicy;
  onSaved: (next: CompanyPolicy) => void;
}) {
  const [google, setGoogle] = useState(policy.googleAllowed);
  const [microsoft, setMicrosoft] = useState(policy.microsoftAllowed);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = google !== policy.googleAllowed || microsoft !== policy.microsoftAllowed;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      onSaved(await connectionsService.updatePolicy(google, microsoft));
      setMessage({ ok: true, text: "Política da empresa salva." });
    } catch (err) {
      setMessage({ ok: false, text: describeError(err, "Não foi possível salvar a política.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="policy-title">
      <h2 id="policy-title" className={styles.sectionTitle}>
        Integrações permitidas pela empresa
      </h2>
      <p className={styles.muted}>
        Defina quais provedores os usuários desta empresa podem conectar. Cada pessoa gerencia só as
        próprias conexões.
      </p>
      <fieldset className={styles.toggles}>
        <legend>Provedores</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={google} onChange={(e) => setGoogle(e.target.checked)} />
          {PROVIDER_LABEL.google}
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={microsoft}
            onChange={(e) => setMicrosoft(e.target.checked)}
          />
          {PROVIDER_LABEL.microsoft}
        </label>
      </fieldset>
      {message && (
        <p
          className={`${styles.alert} ${message.ok ? styles.alertOk : styles.alertBad}`}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "Salvando…" : "Salvar política"}
        </Button>
      </div>
    </section>
  );
}
