import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../common/Button";
import { ROUTES } from "../../constants/routes";
import { notificationsService } from "../../services/NotificationsService";
import { SaveFeedback } from "../notifications/SaveFeedback";
import { saveFailure, type SaveState } from "../../utils/saveState";
import type { NotificationSettings, PolicyPatch } from "../../types/notifications";
import notify from "../notifications/Notifications.module.css";
import styles from "./Automations.module.css";

export type NotificationRuleId = "daily_digest" | "new_lead";

const COPY: Record<
  NotificationRuleId,
  { title: string; summary: string; detail: string; note?: string }
> = {
  daily_digest: {
    title: "Resumo diário",
    summary: "Junta tarefas, compromissos e leads pendentes em uma mensagem por pessoa.",
    detail: "Horário, conteúdo e quem recebe ficam na Central de Notificações.",
    note: "Desligar aqui pausa TODAS as notificações da empresa: resumo diário, novo lead, tarefa atrasada e oportunidade parada.",
  },
  new_lead: {
    title: "Novo lead",
    summary: "Avisa o responsável quando um lead é criado ou atribuído a ele.",
    detail:
      "Os avisos chegam agrupados, a cada poucos minutos. Quem atribui a si mesmo não é avisado.",
  },
};

function isOn(id: NotificationRuleId, settings: NotificationSettings): boolean {
  return id === "daily_digest" ? settings.policy.enabled : settings.policy.triggers.newLead.enabled;
}

function patchFor(id: NotificationRuleId, enabled: boolean): PolicyPatch {
  return id === "daily_digest" ? { enabled } : { triggers: { new_lead: { enabled } } };
}

/**
 * Resumo diário e novo lead JÁ EXISTEM na Central de Notificações (CRM-003B): este cartão
 * só apresenta o mesmo interruptor junto das demais automações e grava pela MESMA API
 * (`PATCH /notifications/settings`) — sem uma segunda fonte de verdade.
 * `settings === null` = a empresa não tem a Central de Notificações ou a pessoa não tem acesso.
 */
export function NotificationRuleCard({
  id,
  settings,
  canEdit,
  onSaved,
  onReload,
}: {
  id: NotificationRuleId;
  settings: NotificationSettings | null;
  canEdit: boolean;
  onSaved: (next: NotificationSettings) => void;
  onReload: () => void;
}) {
  const copy = COPY[id];
  const saved = settings ? isOn(id, settings) : false;
  const [enabled, setEnabled] = useState(saved);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const titleId = `automation-${id}`;
  const dirty = enabled !== saved;

  async function save() {
    if (!settings || !dirty) return;
    setState({ kind: "saving" });
    try {
      const next = await notificationsService.updateSettings({
        version: settings.version,
        policy: patchFor(id, enabled),
      });
      setEnabled(isOn(id, next));
      onSaved(next);
      setState({ kind: "saved", message: "Regra salva." });
    } catch (err) {
      setState(saveFailure(err, "Não foi possível salvar a regra."));
    }
  }

  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <div className={styles.cardHead}>
        <div>
          <h2 id={titleId} className={styles.cardTitle}>
            {copy.title} <span className={styles.badge}>Central de Notificações</span>
          </h2>
          <p className={styles.summary}>{copy.summary}</p>
          <p className={styles.detail}>{copy.detail}</p>
        </div>
        {settings ? (
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canEdit || state.kind === "saving"}
              onChange={(e) => {
                setEnabled(e.target.checked);
                if (state.kind === "saved" || state.kind === "error") setState({ kind: "idle" });
              }}
              aria-label={`Ativar ${copy.title}`}
            />
            {enabled ? "Ligada" : "Desligada"}
          </label>
        ) : (
          <span className={styles.detail}>
            Indisponível: a Central de Notificações não está ativa.
          </span>
        )}
      </div>
      {settings && copy.note && (
        <p
          className={`${notify.notice} ${notify.caution}`}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          {copy.note}
        </p>
      )}
      <SaveFeedback state={state} onReload={onReload} />
      {settings && (
        <p className={styles.linkRow}>
          <Link to={ROUTES.notificacoes}>Configurar na Central de Notificações</Link>
        </p>
      )}
      {settings && canEdit && (
        <div className={styles.cardActions}>
          <Button onClick={() => setEnabled(saved)} disabled={!dirty || state.kind === "saving"}>
            Descartar
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={!dirty || state.kind === "saving"}
          >
            {state.kind === "saving" ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      )}
    </li>
  );
}
