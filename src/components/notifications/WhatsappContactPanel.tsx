import { useState } from "react";
import { Button } from "../common/Button";
import form from "../common/Form.module.css";
import { notificationsService } from "../../services/NotificationsService";
import { CHANNEL_STATUS_LABELS, normalizeE164 } from "../../utils/notifications";
import { formatDateTime } from "../../utils/datetime";
import type { MyPreferences } from "../../types/notifications";
import { SaveFeedback } from "./SaveFeedback";
import { saveFailure, type SaveState } from "../../utils/saveState";
import styles from "./Notifications.module.css";

/**
 * Telefone e consentimento do PRÓPRIO usuário (nunca de outra pessoa).
 * O consentimento nasce desmarcado e só é enviado quando a pessoa marca a
 * caixa e salva. Quem manda no estado é a resposta da API: telefone novo
 * zera autorização e verificação, e nenhum número aparece como verificado
 * (a verificação real só existe no CRM-003B.8).
 */
export function WhatsappContactPanel({
  prefs,
  disabled,
  onSaved,
  onReload,
}: {
  prefs: MyPreferences;
  disabled: boolean;
  onSaved: (next: MyPreferences) => void;
  onReload: () => void;
}) {
  const contact = prefs.whatsapp;
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [agree, setAgree] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const saving = state.kind === "saving";

  const typed = phone.trim();
  const normalized = typed ? normalizeE164(typed) : null;
  const phoneChanged = (normalized ?? typed) !== (contact.phone ?? "");
  const resetsConsent = phoneChanged && contact.consent;

  async function submit(
    whatsapp: { phone?: string | null; consent?: boolean; enabled?: boolean },
    message: string,
  ) {
    setState({ kind: "saving" });
    try {
      const next = await notificationsService.updateMyPreferences({
        version: prefs.version,
        whatsapp,
      });
      onSaved(next);
      setPhone(next.whatsapp.phone ?? "");
      setAgree(false);
      setState({ kind: "saved", message });
    } catch (err) {
      setState(saveFailure(err, "Não foi possível salvar o WhatsApp."));
    }
  }

  async function save() {
    setPhoneError(null);
    if (typed && !normalized) {
      setPhoneError("Telefone inválido. Use o formato internacional, ex.: +5511987654321.");
      return;
    }
    if (agree && !normalized && !contact.phone) {
      setPhoneError("Informe o telefone antes de autorizar o WhatsApp.");
      return;
    }
    const body: { phone?: string | null; consent?: boolean } = {};
    if (phoneChanged) body.phone = normalized;
    if (agree) body.consent = true;
    if (Object.keys(body).length === 0) return;
    await submit(body, agree ? "Telefone e autorização salvos." : "Telefone salvo.");
  }

  return (
    <section aria-labelledby="wa-title" className={styles.group}>
      <h3 id="wa-title" style={{ margin: "0 0 8px", fontSize: 14 }}>
        Telefone e autorização (WhatsApp)
      </h3>
      <p className={`${styles.notice} ${styles.info}`}>
        O envio por WhatsApp ainda não está disponível. Você pode deixar o telefone e a autorização
        prontos; nada é enviado até o canal ser ativado.
      </p>
      <div className={form.field}>
        <label className={form.label} htmlFor="wa-phone">
          Telefone com DDI
        </label>
        <input
          id="wa-phone"
          className={form.input}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+5511987654321"
          value={phone}
          disabled={disabled || saving}
          aria-invalid={Boolean(phoneError)}
          aria-describedby={phoneError ? "wa-phone-error" : undefined}
          onChange={(e) => {
            setPhone(e.target.value);
            setPhoneError(null);
          }}
        />
        {phoneError && (
          <span id="wa-phone-error" className={form.error} role="alert">
            {phoneError}
          </span>
        )}
      </div>
      <dl className={styles.counts} style={{ margin: "10px 0" }}>
        <div>Situação: {CHANNEL_STATUS_LABELS[contact.status]}</div>
        <div>
          Autorização:{" "}
          {contact.consent
            ? `concedida${contact.consentAt ? ` em ${formatDateTime(contact.consentAt)}` : ""}`
            : contact.consentRevokedAt
              ? `revogada em ${formatDateTime(contact.consentRevokedAt)}`
              : "não concedida"}
        </div>
        <div>Número: {contact.verified ? "verificado" : "não verificado"}</div>
      </dl>
      {resetsConsent && (
        <p className={`${styles.notice} ${styles.caution}`} role="alert">
          Ao trocar o telefone, a autorização e a verificação do número atual deixam de valer e você
          precisará autorizar de novo.
        </p>
      )}
      {(!contact.consent || phoneChanged) && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={agree}
            disabled={disabled || saving}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>
            Autorizo o GSM CRM a enviar notificações operacionais (resumo do dia e alertas de novos
            leads) para o número informado, quando o envio por WhatsApp for ativado. Posso revogar a
            qualquer momento.
          </span>
        </label>
      )}
      <SaveFeedback state={state} onReload={onReload} />
      <div className={form.actions}>
        {contact.consent && (
          <Button
            variant="danger"
            disabled={disabled || saving}
            onClick={() => void submit({ consent: false }, "Autorização revogada.")}
          >
            Revogar autorização
          </Button>
        )}
        <Button
          variant="primary"
          disabled={disabled || saving || (!phoneChanged && !agree)}
          onClick={() => void save()}
        >
          {saving ? "Salvando…" : "Salvar telefone"}
        </Button>
      </div>
    </section>
  );
}
