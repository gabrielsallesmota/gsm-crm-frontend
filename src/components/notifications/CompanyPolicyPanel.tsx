import { useState } from "react";
import { Button } from "../common/Button";
import form from "../common/Form.module.css";
import { notificationsService } from "../../services/NotificationsService";
import { policyPatch } from "../../utils/notifications";
import type { NotificationSettings } from "../../types/notifications";
import { NotificationPolicyFields } from "./NotificationPolicyFields";
import { SaveFeedback } from "./SaveFeedback";
import { saveFailure, type SaveState } from "../../utils/saveState";
import styles from "./Notifications.module.css";

/**
 * Política da empresa. Admin edita e salva EXPLICITAMENTE (nada sai
 * enquanto a pessoa navega pelos campos); o PATCH leva só o que mudou e a
 * `version` lida — 409 nunca sobrescreve a outra sessão.
 */
export function CompanyPolicyPanel({
  settings,
  canEdit,
  onSaved,
  onReload,
}: {
  settings: NotificationSettings;
  canEdit: boolean;
  onSaved: (next: NotificationSettings) => void;
  onReload: () => void;
}) {
  const [draft, setDraft] = useState(settings.policy);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const patch = policyPatch(settings.policy, draft);
  const noRecipients = draft.enabled && draft.recipient.roles.length === 0;

  async function save() {
    if (!patch) return;
    setState({ kind: "saving" });
    try {
      const next = await notificationsService.updateSettings({
        version: settings.version,
        policy: patch,
      });
      setDraft(next.policy);
      onSaved(next);
      setState({ kind: "saved", message: "Política salva." });
    } catch (err) {
      setState(saveFailure(err, "Não foi possível salvar a política."));
    }
  }

  return (
    <section aria-labelledby="company-policy-title">
      <h2 id="company-policy-title" className="sr-only">
        Política da empresa
      </h2>
      {!settings.persisted && (
        <p className={`${styles.notice} ${styles.info}`}>
          A empresa ainda usa o padrão aprovado (08:00, todos os dias, tarefas e leads em lista,
          agenda ligada). Nada é gravado até alguém salvar.
        </p>
      )}
      {!canEdit && (
        <p className={`${styles.notice} ${styles.info}`}>
          Somente o administrador altera a política da empresa. Você pode consultá-la e ajustar suas
          preferências em Meu perfil → Minhas notificações.
        </p>
      )}
      <NotificationPolicyFields
        variant="company"
        value={draft}
        onChange={(next) => {
          setDraft(next);
          if (state.kind === "saved" || state.kind === "error") setState({ kind: "idle" });
        }}
        disabled={!canEdit || state.kind === "saving"}
        inheritedTimezone={settings.tenantTimezone}
      />
      {noRecipients && (
        <p className={`${styles.notice} ${styles.caution}`}>
          Nenhum perfil marcado em "Quem recebe": ninguém receberá o resumo.
        </p>
      )}
      <SaveFeedback state={state} onReload={onReload} />
      {canEdit && (
        <div className={form.actions}>
          <Button
            onClick={() => {
              setDraft(settings.policy);
              setState({ kind: "idle" });
            }}
            disabled={!patch || state.kind === "saving"}
          >
            Descartar alterações
          </Button>
          <Button variant="primary" onClick={save} disabled={!patch || state.kind === "saving"}>
            {state.kind === "saving" ? "Salvando…" : "Salvar política"}
          </Button>
        </div>
      )}
    </section>
  );
}
