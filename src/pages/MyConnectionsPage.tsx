import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";
import { useMyConnections, useProvidersOverview } from "../hooks/useConnections";
import { useEditableResource } from "../hooks/useNotifications";
import { toTenantRole } from "../auth/permissions";
import { isImpersonating } from "../auth/impersonation";
import { ROUTES } from "../constants/routes";
import { ResourceGate } from "../components/notifications/ResourceGate";
import { CompanyPolicyPanel } from "../components/connections/CompanyPolicyPanel";
import { ProviderSection } from "../components/connections/ProviderSection";
import type { CompanyPolicy, Connection } from "../types/connections";
import styles from "../components/integrations/Integrations.module.css";
import local from "../components/notifications/Notifications.module.css";

/**
 * Meu perfil → Conexões (CRM-003B.4/B.5). Cada pessoa conecta e gerencia
 * SOMENTE as próprias contas Google/Microsoft; o administrador define quais
 * provedores a empresa permite. Tokens e segredos nunca chegam ao navegador.
 * Em sessão de suporte a tela é só de consulta (o backend também bloqueia).
 */
export function MyConnectionsPage() {
  const { user } = useAuth();
  usePageTitle("Minhas conexões");
  const overviewState = useProvidersOverview();
  const connectionsState = useMyConnections();
  const { value: overview } = useEditableResource(overviewState);
  const { value: loaded, setValue: setLoaded } = useEditableResource(connectionsState);
  const [policy, setPolicy] = useState<CompanyPolicy | null>(null);
  const supporting = isImpersonating(user);
  const isAdmin = toTenantRole(user?.role) === "admin";

  const gateState = {
    notImplemented: overviewState.notImplemented || connectionsState.notImplemented,
    error: overviewState.error ?? connectionsState.error,
    reload: () => {
      overviewState.reload();
      connectionsState.reload();
    },
  };

  function replace(updated: Connection) {
    setLoaded((loaded ?? []).map((c) => (c.id === updated.id ? updated : c)));
  }
  function remove(id: string) {
    setLoaded((loaded ?? []).filter((c) => c.id !== id));
  }

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Minhas conexões</h1>
        <p className={styles.subtitle}>
          Conecte seu Google ou Microsoft para ver seus compromissos e tarefas junto com os do CRM.
          A sincronização é automática (a cada 15 minutos) e você pode sincronizar na hora. O CRM
          nunca lê nem envia e-mails.
        </p>
        <p className={styles.subtitle}>
          <Link to={ROUTES.perfil}>← Voltar ao perfil</Link>
        </p>
      </header>
      {supporting && (
        <p className={`${local.notice} ${local.info}`} role="status">
          Sessão de suporte: as conexões são da pessoa e só podem ser consultadas.
        </p>
      )}
      <ResourceGate state={gateState} value={overview && loaded ? { overview, loaded } : null}>
        {(data) => {
          const current = policy ?? data.overview.policy;
          const providers = data.overview.providers.map((p) => ({
            ...p,
            allowed: p.provider === "google" ? current.googleAllowed : current.microsoftAllowed,
          }));
          return (
            <>
              {providers.map((info) => (
                <ProviderSection
                  key={info.provider}
                  info={info}
                  connections={data.loaded.filter((c) => c.provider === info.provider)}
                  readOnly={supporting}
                  onChanged={replace}
                  onRemoved={remove}
                />
              ))}
              {isAdmin && !supporting && (
                <CompanyPolicyPanel key={String(current.persisted)} policy={current} onSaved={setPolicy} />
              )}
            </>
          );
        }}
      </ResourceGate>
    </div>
  );
}
