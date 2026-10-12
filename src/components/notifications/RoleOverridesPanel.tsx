import { useState } from "react";
import { Button } from "../common/Button";
import form from "../common/Form.module.css";
import { roleLabel, type TenantRole } from "../../auth/permissions";
import { notificationsService } from "../../services/NotificationsService";
import { applyPatch, roleOverrideBody } from "../../utils/notifications";
import type { NotificationSettings } from "../../types/notifications";
import { NotificationPolicyFields } from "./NotificationPolicyFields";
import { SaveFeedback } from "./SaveFeedback";
import { saveFailure, type SaveState } from "../../utils/saveState";
import styles from "./Notifications.module.css";

const ROLES: TenantRole[] = ["admin", "gestor", "vendedor"];

export function RoleOverridesPanel({
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
  const [role, setRole] = useState<TenantRole>("gestor");
  const saved = settings.roles[role];
  const [custom, setCustom] = useState(Boolean(saved));
  const [draft, setDraft] = useState(() => applyPatch(settings.policy, saved));
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  function pick(next: TenantRole) {
    const override = settings.roles[next];
    setRole(next);
    setCustom(Boolean(override));
    setDraft(applyPatch(settings.policy, override));
    setState({ kind: "idle" });
  }

  // Só o que diverge da empresa (ou já estava personalizado) — ver roleOverrideBody.
  const body = custom ? roleOverrideBody(role, settings.policy, saved, draft) : undefined;
  const changed = custom
    ? Boolean(body) && JSON.stringify(body) !== JSON.stringify(saved)
    : Boolean(saved);

  async function save() {
    if (custom && !body) return;
    setState({ kind: "saving" });
    try {
      const next = await notificationsService.updateSettings({
        version: settings.version,
        roles: { [role]: custom ? (body ?? null) : null },
      });
      onSaved(next);
      setDraft(applyPatch(next.policy, next.roles[role]));
      setState({
        kind: "saved",
        message: custom
          ? `Ajuste do perfil ${roleLabel(role)} salvo.`
          : `${roleLabel(role)} volta a seguir a política da empresa.`,
      });
    } catch (err) {
      setState(saveFailure(err, "Não foi possível salvar o ajuste do perfil."));
    }
  }

  const receives = settings.policy.recipient.roles.includes(role);

  return (
    <section aria-labelledby="role-overrides-title">
      <h2 id="role-overrides-title" className="sr-only">
        Configurações por perfil
      </h2>
      <div className={styles.subnav} role="tablist" aria-label="Perfil">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === role}
            className={`${styles.subnavLink} ${r === role ? styles.subnavActive : ""}`}
            onClick={() => pick(r)}
          >
            {roleLabel(r)}
            {settings.roles[r] ? " · personalizado" : ""}
          </button>
        ))}
      </div>
      {!receives && (
        <p className={`${styles.notice} ${styles.caution}`}>
          {roleLabel(role)} não está entre os perfis que recebem (ajuste em Política da empresa →
          Quem recebe). O ajuste fica guardado para quando o perfil passar a receber.
        </p>
      )}
      <label className={styles.check} style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={custom}
          disabled={!canEdit || state.kind === "saving"}
          onChange={(e) => {
            setCustom(e.target.checked);
            if (!e.target.checked) setDraft(settings.policy);
          }}
        />
        <span>Personalizar para {roleLabel(role)} (senão segue a política da empresa)</span>
      </label>
      <NotificationPolicyFields
        variant="role"
        value={draft}
        onChange={setDraft}
        disabled={!canEdit || !custom || state.kind === "saving"}
        teamScopeAllowed={role !== "vendedor"}
      />
      <SaveFeedback state={state} onReload={onReload} />
      {canEdit && (
        <div className={form.actions}>
          <Button variant="primary" onClick={save} disabled={!changed || state.kind === "saving"}>
            {state.kind === "saving" ? "Salvando…" : `Salvar ajuste de ${roleLabel(role)}`}
          </Button>
        </div>
      )}
    </section>
  );
}
