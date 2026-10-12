import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  useEditableResource,
  useMyNotificationPreferences,
  useNotificationSettings,
} from "../hooks/useNotifications";
import { toTenantRole } from "../auth/permissions";
import { isImpersonating } from "../auth/impersonation";
import { ROUTES } from "../constants/routes";
import { DeliveriesPanel } from "../components/notifications/DeliveriesPanel";
import { PersonalPreferencesPanel } from "../components/notifications/PersonalPreferencesPanel";
import { PreviewPanel } from "../components/notifications/PreviewPanel";
import { ResourceGate } from "../components/notifications/ResourceGate";
import styles from "../components/integrations/Integrations.module.css";
import local from "../components/notifications/Notifications.module.css";

type Tab = "prefs" | "preview" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "prefs", label: "Preferências" },
  { id: "preview", label: "Prévia" },
  { id: "history", label: "Meu histórico" },
];

/**
 * Meu perfil → Minhas notificações (CRM-003B.3). Qualquer membro com a
 * feature contratada. Preferências só reduzem o que a empresa permite;
 * telefone e autorização são sempre do próprio usuário. Em sessão de
 * suporte tudo é somente leitura (o backend bloqueia as escritas).
 */
export function MyNotificationsPage() {
  const { user } = useAuth();
  usePageTitle("Minhas notificações");
  const [tab, setTab] = useState<Tab>("prefs");
  const prefsState = useMyNotificationPreferences();
  const settingsState = useNotificationSettings();
  const { value: prefs, setValue: setPrefs, epoch } = useEditableResource(prefsState);
  const role = toTenantRole(user?.role);
  const supporting = isImpersonating(user);

  const gateState = {
    notImplemented: prefsState.notImplemented || settingsState.notImplemented,
    error: prefsState.error ?? settingsState.error,
    reload: () => {
      prefsState.reload();
      settingsState.reload();
    },
  };

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Minhas notificações</h1>
        <p className={styles.subtitle}>
          Escolha o que você quer receber, seu telefone e seu fuso. A empresa define o limite — você
          pode reduzir, não ampliar. O envio por WhatsApp ainda não está disponível.
        </p>
        <p className={styles.subtitle}>
          <Link to={ROUTES.perfil}>← Voltar ao perfil</Link>
        </p>
      </header>
      {supporting && (
        <p className={`${local.notice} ${local.info}`} role="status">
          Sessão de suporte: as preferências são da pessoa e só podem ser consultadas.
        </p>
      )}
      <ResourceGate state={gateState} value={prefs && settingsState.data && role ? prefs : null}>
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
            <div role="tabpanel">
              {tab === "prefs" && settingsState.data && role && (
                <PersonalPreferencesPanel
                  key={epoch}
                  settings={settingsState.data}
                  prefs={current}
                  role={role}
                  canEdit={!supporting}
                  onSaved={setPrefs}
                  onReload={() => {
                    prefsState.reload();
                    settingsState.reload();
                  }}
                />
              )}
              {tab === "preview" && <PreviewPanel />}
              {tab === "history" && (
                <DeliveriesPanel timezone={current.effective.timezone} showRecipient={false} />
              )}
            </div>
          </>
        )}
      </ResourceGate>
    </div>
  );
}
