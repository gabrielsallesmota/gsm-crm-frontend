import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAutomationRules } from "../hooks/useAutomations";
import { useEditableResource } from "../hooks/useNotifications";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { can } from "../auth/permissions";
import { hasFeature } from "../auth/features";
import { isImpersonating } from "../auth/impersonation";
import { ROUTES } from "../constants/routes";
import { notificationsService } from "../services/NotificationsService";
import { NotificationRuleCard } from "../components/automations/NotificationRuleCard";
import { RuleCard } from "../components/automations/RuleCard";
import { ResourceGate } from "../components/notifications/ResourceGate";
import type { AutomationKey, AutomationRule } from "../types/automations";
import type { NotificationSettings } from "../types/notifications";
import notify from "../components/notifications/Notifications.module.css";
import styles from "../components/integrations/Integrations.module.css";
import local from "../components/automations/Automations.module.css";

/**
 * Configurações → Automações comerciais (CRM-003C). Cinco automações, uma lista: três regras
 * próprias (follow-up, tarefa atrasada, oportunidade parada — `/automations`) e duas que já
 * existiam na Central de Notificações (resumo diário e novo lead), mostradas aqui e gravadas
 * pela MESMA API de lá. Admin edita; gestor consulta; o backend recusa o resto (403).
 * Nenhuma regra envia mensagem para cliente final.
 */
export function AutomationsPage() {
  const { user } = useAuth();
  usePageTitle("Automações comerciais");
  const rulesState = useAutomationRules();
  const rules = useEditableResource(rulesState);
  const canEdit = can(user, "automations.manage") && !isImpersonating(user);
  const canReadNotifications = hasFeature(user, "notifications") && can(user, "notifications.view");
  const canEditNotifications = canEdit && can(user, "notifications.manage");
  const settingsState = useAsyncResource<NotificationSettings | null>(
    () => (canReadNotifications ? notificationsService.getSettings() : Promise.resolve(null)),
    [canReadNotifications],
  );
  const settings = useEditableResource(settingsState);

  const byKey = useMemo(() => {
    const map = new Map<AutomationKey, AutomationRule>();
    for (const rule of rules.value ?? []) map.set(rule.key, rule);
    return map;
  }, [rules.value]);

  function replace(next: AutomationRule) {
    rules.setValue((rules.value ?? []).map((r) => (r.key === next.key ? next : r)));
  }

  function ruleCard(key: AutomationKey) {
    const rule = byKey.get(key);
    if (!rule) return null;
    return (
      <RuleCard
        key={`${key}-${rules.epoch}`}
        rule={rule}
        canEdit={canEdit}
        onSaved={replace}
        onReload={rulesState.reload}
      />
    );
  }

  function notificationCard(id: "daily_digest" | "new_lead") {
    const current = settings.value;
    return (
      <NotificationRuleCard
        key={`${id}-${settings.epoch}`}
        id={id}
        settings={current}
        canEdit={canEditNotifications}
        onSaved={settings.setValue}
        onReload={settingsState.reload}
      />
    );
  }

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Automações comerciais</h1>
        <p className={styles.subtitle}>
          Ligue ou desligue cada automação e ajuste os prazos da sua empresa. Nenhuma delas envia
          mensagem para o cliente: criam tarefas internas ou avisam a equipe.
        </p>
        <p className={styles.subtitle}>
          Quem recebe cada aviso, o horário e o conteúdo do resumo ficam em{" "}
          <Link to={ROUTES.notificacoes}>Notificações</Link>.
        </p>
      </header>
      {!canEdit && (
        <p className={`${notify.notice} ${notify.info}`}>
          Somente o administrador altera as automações. Você pode consultar como estão configuradas.
        </p>
      )}
      <ResourceGate
        state={rulesState}
        value={rules.value}
        demoMessage="As automações usam a API real e não funcionam no modo demonstração."
      >
        {() => (
          <ul className={local.list} aria-label="Automações">
            {notificationCard("new_lead")}
            {ruleCard("follow_up")}
            {ruleCard("overdue_task")}
            {notificationCard("daily_digest")}
            {ruleCard("stalled_opportunity")}
          </ul>
        )}
      </ResourceGate>
    </div>
  );
}
