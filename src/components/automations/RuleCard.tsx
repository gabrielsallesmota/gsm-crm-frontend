import { useState } from "react";
import { Button } from "../common/Button";
import { automationsService } from "../../services/AutomationsService";
import { SaveFeedback } from "../notifications/SaveFeedback";
import { saveFailure, type SaveState } from "../../utils/saveState";
import { RULE_COPY, changedParams, validateDraft } from "../../utils/automations";
import type { AutomationRule } from "../../types/automations";
import notify from "../notifications/Notifications.module.css";
import styles from "./Automations.module.css";

/**
 * Uma regra própria da CRM-003C (follow-up, tarefa atrasada, oportunidade parada).
 * Salvar é EXPLÍCITO e leva só o que mudou + a `version` lida: 409 nunca sobrescreve a
 * alteração de outra pessoa. Quem não é admin só consulta.
 */
export function RuleCard({
  rule,
  canEdit,
  onSaved,
  onReload,
}: {
  rule: AutomationRule;
  canEdit: boolean;
  onSaved: (next: AutomationRule) => void;
  onReload: () => void;
}) {
  const copy = RULE_COPY[rule.key];
  const [enabled, setEnabled] = useState(rule.enabled);
  const [draft, setDraft] = useState<Record<string, number | null>>({ ...rule.params });
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const problem = validateDraft(rule, draft);
  const params = changedParams(rule, draft);
  const dirty = enabled !== rule.enabled || params !== undefined;
  const titleId = `automation-${rule.key}`;

  function touch() {
    if (state.kind === "saved" || state.kind === "error") setState({ kind: "idle" });
  }

  async function save() {
    if (!dirty || problem) return;
    setState({ kind: "saving" });
    try {
      const next = await automationsService.update(rule.key, {
        version: rule.version,
        enabled: enabled !== rule.enabled ? enabled : undefined,
        params,
      });
      setEnabled(next.enabled);
      setDraft({ ...next.params });
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
            {copy.title}
          </h2>
          <p className={styles.summary}>{copy.summary}</p>
          <p className={styles.detail}>{copy.detail}</p>
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit || state.kind === "saving"}
            onChange={(e) => {
              setEnabled(e.target.checked);
              touch();
            }}
            aria-label={`Ativar ${copy.title}`}
          />
          {enabled ? "Ligada" : "Desligada"}
        </label>
      </div>

      <div className={styles.params}>
        {Object.entries(copy.params).map(([name, p]) => {
          const limits = rule.limits[name];
          return (
            <div key={name} className={styles.param}>
              <label htmlFor={`${titleId}-${name}`}>{p.label}</label>
              <div className={styles.paramRow}>
                <input
                  id={`${titleId}-${name}`}
                  type="number"
                  inputMode="numeric"
                  min={limits?.minimum}
                  max={limits?.maximum}
                  value={draft[name] ?? ""}
                  disabled={!canEdit || state.kind === "saving"}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDraft({ ...draft, [name]: raw === "" ? null : Number(raw) });
                    touch();
                  }}
                />
                <span className={styles.unit}>{p.unit}</span>
              </div>
              <p className={styles.hint}>{p.hint}</p>
            </div>
          );
        })}
      </div>

      {copy.notifies && (
        <p className={`${notify.notice} ${notify.info}`} style={{ marginTop: 12, marginBottom: 0 }}>
          O aviso chega por WhatsApp a quem é destinatário em Notificações e cadastrou telefone e
          autorização. Nada é enviado ao cliente final.
        </p>
      )}
      {problem && canEdit && (
        <p className={styles.fieldError} role="alert">
          {problem}
        </p>
      )}
      <SaveFeedback state={state} onReload={onReload} />
      {canEdit && (
        <div className={styles.cardActions}>
          <Button
            onClick={() => {
              setEnabled(rule.enabled);
              setDraft({ ...rule.params });
              setState({ kind: "idle" });
            }}
            disabled={!dirty || state.kind === "saving"}
          >
            Descartar
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={!dirty || Boolean(problem) || state.kind === "saving"}
          >
            {state.kind === "saving" ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      )}
    </li>
  );
}
