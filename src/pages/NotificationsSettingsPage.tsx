import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  useEditableResource,
  useNotificationRecipients,
  useNotificationSettings,
} from "../hooks/useNotifications";
import { can } from "../auth/permissions";
import { isImpersonating } from "../auth/impersonation";
import { ROUTES } from "../constants/routes";
import { CompanyPolicyPanel } from "../components/notifications/CompanyPolicyPanel";
import { DeliveriesPanel } from "../components/notifications/DeliveriesPanel";
import { PreviewPanel } from "../components/notifications/PreviewPanel";
import { RecipientsPanel } from "../components/notifications/RecipientsPanel";
import { ResourceGate } from "../components/notifications/ResourceGate";
import { RoleOverridesPanel } from "../components/notifications/RoleOverridesPanel";
import styles from "../components/integrations/Integrations.module.css";
import local from "../components/notifications/Notifications.module.css";

type Tab = "policy" | "roles" | "recipients" | "preview" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "policy", label: "Política da empresa" },
  { id: "roles", label: "Por perfil" },
  { id: "recipients", label: "Destinatários" },
  { id: "preview", label: "Prévia" },
  { id: "history", label: "Histórico" },
];

/**
 * Configurações → Notificações (CRM-003B.3). Rota: feature `notifications` +
 * permissão `notifications.view` (admin e gestor). Só o admin edita
 * (`notifications.manage`), nunca em sessão de suporte; o backend recusa de
 * qualquer jeito (403). Nenhuma ação desta tela envia mensagem.
 */
export function NotificationsSettingsPage() {
  const { user } = useAuth();
  usePageTitle("Notificações");
  const [tab, setTab] = useState<Tab>("policy");
  const [previewFor, setPreviewFor] = useState<string | undefined>();
  const state = useNotificationSettings();
  const { value: settings, setValue, epoch } = useEditableResource(state);
  const recipients = useNotificationRecipients(1);
  const canEdit = can(user, "notifications.manage") && !isImpersonating(user);
  const isAdmin = user?.role === "admin";

  const names = useMemo(
    () => Object.fromEntries((recipients.data?.items ?? []).map((r) => [r.userId, r.name])),
    [recipients.data],
  );
  const recipientOptions = useMemo(
    () => (recipients.data?.items ?? []).map((r) => ({ userId: r.userId, name: r.name })),
    [recipients.data],
  );

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Notificações</h1>
        <p className={styles.subtitle}>
          Defina quando e o que cada pessoa da equipe recebe. O envio por WhatsApp ainda não está
          disponível: por enquanto você configura, pré-visualiza e acompanha o histórico.
        </p>
        <p className={styles.subtitle}>
          Quer ajustar só o seu?{" "}
          <Link to={ROUTES.minhasNotificacoes}>Meu perfil → Minhas notificações</Link>
        </p>
      </header>
      <ResourceGate state={state} value={settings}>
        {(current) => (
          <>
            <div className={styles.tabs} role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={local.stack} role="tabpanel">
              {tab === "policy" && (
                <CompanyPolicyPanel
                  key={epoch}
                  settings={current}
                  canEdit={canEdit}
                  onSaved={setValue}
                  onReload={state.reload}
                />
              )}
              {tab === "roles" && (
                <RoleOverridesPanel
                  key={epoch}
                  settings={current}
                  canEdit={canEdit}
                  onSaved={setValue}
                  onReload={state.reload}
                />
              )}
              {tab === "recipients" && <RecipientsPanel />}
              {tab === "preview" && (
                <PreviewPanel
                  recipientUserId={previewFor}
                  recipientOptions={isAdmin ? recipientOptions : undefined}
                  onRecipientChange={setPreviewFor}
                />
              )}
              {tab === "history" && (
                <DeliveriesPanel
                  timezone={current.effective?.timezone ?? current.tenantTimezone}
                  recipientNames={names}
                  showRecipient
                />
              )}
            </div>
          </>
        )}
      </ResourceGate>
    </div>
  );
}
