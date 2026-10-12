import { useId } from "react";
import form from "../common/Form.module.css";
import styles from "./Notifications.module.css";
import { roleLabel, type TenantRole } from "../../auth/permissions";
import { SECTION_MODE_LABELS } from "../../utils/notifications";
import { TimezoneSelect } from "./TimezoneSelect";
import type { NotificationPolicy, SectionMode } from "../../types/notifications";

/**
 * Editor ÚNICO dos campos de notificação — reaproveitado pela política da
 * empresa (`company`), pelos ajustes por perfil (`role`) e pela preferência
 * pessoal (`personal`). Cada variante mostra só o que o backend aceita
 * naquele nível; `locks` explica por que um campo não pode ser ampliado.
 */
export type PolicyFieldsVariant = "company" | "role" | "personal";

const MODES: SectionMode[] = ["list", "count", "off"];
const ROLES: TenantRole[] = ["admin", "gestor", "vendedor"];
const MAX_ITEMS = 20;

interface Props {
  value: NotificationPolicy;
  onChange: (next: NotificationPolicy) => void;
  variant: PolicyFieldsVariant;
  disabled?: boolean;
  /** Fuso que vale quando `schedule.timezone` é `null` (herdado). */
  inheritedTimezone?: string;
  /** Campo → motivo do bloqueio (ex.: a empresa não permite). */
  locks?: Partial<Record<LockKey, string>>;
  /** Escopo TEAM indisponível (vendedor é sempre "só os meus"). */
  teamScopeAllowed?: boolean;
  /** Teto vindo da empresa/perfil (preferência pessoal só reduz). */
  limits?: { tasks?: SectionLimit; leads?: SectionLimit };
}

export interface SectionLimit {
  modes: SectionMode[];
  maxItems: number;
}

export type LockKey =
  | "enabled"
  | "includeWeekends"
  | "scope"
  | "tasks"
  | "leads"
  | "includeOverdue"
  | "calendar"
  | "opportunities"
  | "newLead";

export function NotificationPolicyFields({
  value,
  onChange,
  variant,
  disabled = false,
  inheritedTimezone,
  locks = {},
  teamScopeAllowed = true,
  limits = {},
}: Props) {
  const id = useId();
  const set = (patch: (draft: NotificationPolicy) => NotificationPolicy) => onChange(patch(value));
  const lockNote = (key: LockKey) =>
    locks[key] ? <span className={styles.lock}>🔒 {locks[key]}</span> : null;
  const isCompany = variant === "company";

  return (
    <div>
      {variant !== "role" && (
        <fieldset className={styles.group} disabled={disabled}>
          <legend>{isCompany ? "Política da empresa" : "Receber notificações"}</legend>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={value.enabled}
              disabled={Boolean(locks.enabled) && !value.enabled}
              onChange={(e) => set((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>
              {isCompany
                ? "Notificações ativas para a empresa"
                : "Quero receber o resumo e os alertas"}
            </span>
          </label>
          {lockNote("enabled")}
          {isCompany && (
            <div className={form.row} style={{ marginTop: 10 }}>
              <div className={form.field}>
                <span className={form.label}>Canal</span>
                <span>WhatsApp (disponível em breve)</span>
              </div>
              <div className={form.field}>
                <span className={form.label}>Quem recebe</span>
                <div className={styles.check} role="group" aria-label="Perfis que recebem">
                  {ROLES.map((role) => (
                    <label key={role} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={value.recipient.roles.includes(role)}
                        onChange={(e) =>
                          set((d) => ({
                            ...d,
                            recipient: {
                              ...d.recipient,
                              roles: e.target.checked
                                ? [...d.recipient.roles, role]
                                : d.recipient.roles.filter((r) => r !== role),
                            },
                          }))
                        }
                      />
                      {roleLabel(role)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </fieldset>
      )}

      <fieldset className={styles.group} disabled={disabled}>
        <legend>Horário e frequência</legend>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${id}-time`}>
              Horário (diário)
            </label>
            <input
              id={`${id}-time`}
              className={form.input}
              type="time"
              step={60}
              required
              value={value.schedule.time}
              onChange={(e) =>
                set((d) => ({ ...d, schedule: { ...d.schedule, time: e.target.value } }))
              }
            />
          </div>
          {isCompany && (
            <div className={form.field}>
              <label className={form.label} htmlFor={`${id}-tz`}>
                Fuso horário
              </label>
              <TimezoneSelect
                id={`${id}-tz`}
                value={value.schedule.timezone}
                inheritedLabel={`Fuso da organização (${inheritedTimezone ?? "—"})`}
                onChange={(tz) => set((d) => ({ ...d, schedule: { ...d.schedule, timezone: tz } }))}
              />
            </div>
          )}
        </div>
        <label className={styles.check} style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={value.schedule.includeWeekends}
            disabled={Boolean(locks.includeWeekends) && !value.schedule.includeWeekends}
            onChange={(e) =>
              set((d) => ({ ...d, schedule: { ...d.schedule, includeWeekends: e.target.checked } }))
            }
          />
          <span>Enviar também aos sábados e domingos</span>
        </label>
        {lockNote("includeWeekends")}
      </fieldset>

      <fieldset className={styles.group} disabled={disabled}>
        <legend>Escopo</legend>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${id}-scope`}>
            Dados incluídos
          </label>
          <select
            id={`${id}-scope`}
            className={form.select}
            value={teamScopeAllowed ? value.recipient.scope : "self"}
            disabled={!teamScopeAllowed}
            onChange={(e) =>
              set((d) => ({
                ...d,
                recipient: { ...d.recipient, scope: e.target.value === "team" ? "team" : "self" },
              }))
            }
          >
            <option value="team">Equipe inteira</option>
            <option value="self">Só os meus (responsável)</option>
          </select>
          {!teamScopeAllowed && (
            <span className={form.hint}>Vendedores sempre recebem só os próprios dados.</span>
          )}
          {lockNote("scope")}
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={disabled}>
        <legend>Conteúdo do resumo</legend>
        <div className={form.row}>
          {(["tasks", "leads"] as const).map((key) => (
            <div className={form.field} key={key}>
              <label className={form.label} htmlFor={`${id}-${key}`}>
                {key === "tasks" ? "Tarefas" : "Leads"}
              </label>
              <select
                id={`${id}-${key}`}
                className={form.select}
                value={value.content[key].mode}
                onChange={(e) =>
                  set((d) => ({
                    ...d,
                    content: {
                      ...d.content,
                      [key]: { ...d.content[key], mode: e.target.value as SectionMode },
                    },
                  }))
                }
              >
                {(limits[key]?.modes ?? MODES).map((m) => (
                  <option key={m} value={m}>
                    {SECTION_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
              <label className={form.hint} htmlFor={`${id}-${key}-max`}>
                Máximo de itens
              </label>
              <input
                id={`${id}-${key}-max`}
                className={form.input}
                type="number"
                min={1}
                max={limits[key]?.maxItems ?? MAX_ITEMS}
                value={value.content[key].maxItems}
                disabled={value.content[key].mode !== "list"}
                onChange={(e) =>
                  set((d) => ({
                    ...d,
                    content: {
                      ...d.content,
                      [key]: {
                        ...d.content[key],
                        maxItems: clampItems(e.target.value, limits[key]?.maxItems),
                      },
                    },
                  }))
                }
              />
              {lockNote(key)}
            </div>
          ))}
        </div>
        <label className={styles.check} style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={value.content.includeOverdue}
            disabled={Boolean(locks.includeOverdue) && !value.content.includeOverdue}
            onChange={(e) =>
              set((d) => ({ ...d, content: { ...d.content, includeOverdue: e.target.checked } }))
            }
          />
          <span>Incluir tarefas e contatos atrasados</span>
        </label>
        {lockNote("includeOverdue")}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.content.calendar.enabled}
            disabled={Boolean(locks.calendar) && !value.content.calendar.enabled}
            onChange={(e) =>
              set((d) => ({
                ...d,
                content: {
                  ...d.content,
                  calendar: { ...d.content.calendar, enabled: e.target.checked },
                },
              }))
            }
          />
          <span>Agenda do dia</span>
        </label>
        {lockNote("calendar")}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.content.opportunities.enabled}
            disabled={Boolean(locks.opportunities) && !value.content.opportunities.enabled}
            onChange={(e) =>
              set((d) => ({
                ...d,
                content: {
                  ...d.content,
                  opportunities: { ...d.content.opportunities, enabled: e.target.checked },
                },
              }))
            }
          />
          <span>Oportunidades (leads abertos com maior valor)</span>
        </label>
        {lockNote("opportunities")}
      </fieldset>

      <fieldset className={styles.group} disabled={disabled}>
        <legend>Alertas</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.triggers.newLead.enabled}
            disabled={Boolean(locks.newLead) && !value.triggers.newLead.enabled}
            onChange={(e) =>
              set((d) => ({ ...d, triggers: { newLead: { enabled: e.target.checked } } }))
            }
          />
          <span>Avisar quando chegarem novos leads (agrupados a cada 5 minutos)</span>
        </label>
        {lockNote("newLead")}
      </fieldset>
    </div>
  );
}

function clampItems(raw: string, max = MAX_ITEMS): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, n));
}
