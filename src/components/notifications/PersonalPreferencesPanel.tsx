import { useMemo, useState } from "react";
import { Button } from "../common/Button";
import form from "../common/Form.module.css";
import type { TenantRole } from "../../auth/permissions";
import { notificationsService } from "../../services/NotificationsService";
import {
  allowedModes,
  ceilingPolicy,
  policyPatch,
  restrictedLabel,
} from "../../utils/notifications";
import type {
  MyPreferences,
  NotificationPolicy,
  NotificationSettings,
} from "../../types/notifications";
import { NotificationPolicyFields, type LockKey } from "./NotificationPolicyFields";
import { SaveFeedback } from "./SaveFeedback";
import { saveFailure, type SaveState } from "../../utils/saveState";
import { TimezoneSelect } from "./TimezoneSelect";
import { WhatsappContactPanel } from "./WhatsappContactPanel";
import styles from "./Notifications.module.css";

function locksFor(ceiling: NotificationPolicy): Partial<Record<LockKey, string>> {
  const why = "A empresa não permite ativar isto.";
  const locks: Partial<Record<LockKey, string>> = {};
  if (!ceiling.enabled) locks.enabled = why;
  if (!ceiling.schedule.includeWeekends) locks.includeWeekends = why;
  if (ceiling.recipient.scope === "self") locks.scope = "Seu perfil recebe só os próprios dados.";
  if (!ceiling.content.includeOverdue) locks.includeOverdue = why;
  if (!ceiling.content.calendar.enabled) locks.calendar = why;
  if (!ceiling.content.opportunities.enabled) locks.opportunities = why;
  if (!ceiling.triggers.newLead.enabled) locks.newLead = why;
  if (ceiling.content.tasks.mode === "off") locks.tasks = why;
  if (ceiling.content.leads.mode === "off") locks.leads = why;
  return locks;
}

export function PersonalPreferencesPanel({
  settings,
  prefs,
  role,
  canEdit,
  onSaved,
  onReload,
}: {
  settings: NotificationSettings;
  prefs: MyPreferences;
  role: TenantRole;
  canEdit: boolean;
  onSaved: (next: MyPreferences) => void;
  onReload: () => void;
}) {
  const ceiling = useMemo(() => ceilingPolicy(settings, role), [settings, role]);
  const effective = prefs.effective;
  const [draft, setDraft] = useState(effective.policy);
  const [timezone, setTimezone] = useState<string | null>(prefs.timezone);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const saving = state.kind === "saving";

  const patch = policyPatch(effective.policy, draft);
  const tzChanged = timezone !== prefs.timezone;
  const dirty = Boolean(patch) || tzChanged;

  async function save() {
    setState({ kind: "saving" });
    try {
      const next = await notificationsService.updateMyPreferences({
        version: prefs.version,
        ...(patch ? { preferences: patch } : {}),
        ...(tzChanged ? { timezone } : {}),
      });
      onSaved(next);
      setDraft(next.effective.policy);
      setTimezone(next.timezone);
      setState({ kind: "saved", message: "Preferências salvas." });
    } catch (err) {
      setState(saveFailure(err, "Não foi possível salvar suas preferências."));
    }
  }

  async function reset() {
    setState({ kind: "saving" });
    try {
      const next = await notificationsService.updateMyPreferences({
        version: prefs.version,
        resetPreferences: true,
      });
      onSaved(next);
      setDraft(next.effective.policy);
      setState({ kind: "saved", message: "Voltou ao padrão da empresa." });
    } catch (err) {
      setState(saveFailure(err, "Não foi possível restaurar o padrão."));
    }
  }

  return (
    <div className={styles.stack}>
      {!effective.receives && effective.notReceivingReason && (
        <p className={`${styles.notice} ${styles.caution}`} role="status">
          Hoje você não receberia o resumo:{" "}
          {effective.notReceivingReason === "role_not_recipient"
            ? "seu perfil não está entre os destinatários definidos pela empresa."
            : effective.notReceivingReason === "company_disabled"
              ? "as notificações estão desligadas pela empresa."
              : "você desativou as notificações."}
        </p>
      )}
      {effective.restrictedFields.length > 0 && (
        <p className={`${styles.notice} ${styles.caution}`} role="status">
          Alguns ajustes seus passam do que a empresa permite e foram ignorados:{" "}
          {effective.restrictedFields.map(restrictedLabel).join(", ")}.
        </p>
      )}
      <section aria-labelledby="my-prefs-title">
        <h2 id="my-prefs-title" className="sr-only">
          Preferências pessoais
        </h2>
        <NotificationPolicyFields
          variant="personal"
          value={draft}
          onChange={(next) => {
            setDraft(next);
            if (state.kind === "saved" || state.kind === "error") setState({ kind: "idle" });
          }}
          disabled={!canEdit || saving}
          locks={locksFor(ceiling)}
          teamScopeAllowed={ceiling.recipient.scope === "team"}
          limits={{
            tasks: {
              modes: allowedModes(ceiling.content.tasks.mode),
              maxItems: ceiling.content.tasks.maxItems,
            },
            leads: {
              modes: allowedModes(ceiling.content.leads.mode),
              maxItems: ceiling.content.leads.maxItems,
            },
          }}
        />
        <fieldset className={styles.group} disabled={!canEdit || saving}>
          <legend>Fuso horário</legend>
          <div className={form.field}>
            <label className={form.label} htmlFor="my-tz">
              Fuso das suas notificações
            </label>
            <TimezoneSelect
              id="my-tz"
              value={timezone}
              inheritedLabel={`Seguir a empresa (${settings.policy.schedule.timezone ?? settings.tenantTimezone})`}
              onChange={setTimezone}
            />
            <span className={form.hint}>
              Vale só para você; não muda o fuso da empresa. Em uso agora: {effective.timezone}.
            </span>
          </div>
        </fieldset>
        <SaveFeedback state={state} onReload={onReload} />
        {canEdit && (
          <div className={form.actions}>
            {prefs.persisted && (
              <Button onClick={() => void reset()} disabled={saving}>
                Restaurar padrão da empresa
              </Button>
            )}
            <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? "Salvando…" : "Salvar preferências"}
            </Button>
          </div>
        )}
      </section>
      <WhatsappContactPanel
        prefs={prefs}
        disabled={!canEdit}
        onSaved={onSaved}
        onReload={onReload}
      />
    </div>
  );
}
