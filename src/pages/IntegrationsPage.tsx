import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { hasFeature } from "../auth/features";
import { isImpersonating, isReadOnlySupport } from "../auth/impersonation";
import { ApiCredentialsTab } from "../components/integrations/ApiCredentialsTab";
import { WebhooksTab } from "../components/integrations/WebhooksTab";
import styles from "../components/integrations/Integrations.module.css";

type Tab = "api" | "webhooks";

/**
 * Configurações → Integrações (Etapa 3) — só Admin do tenant (rota
 * `integrations.manage`). Cada aba só aparece se a funcionalidade estiver
 * contratada (`api` / `webhooks`); o backend recusa com 403 de qualquer
 * jeito. Segredos nunca são exibidos depois da criação/rotação.
 */
export function IntegrationsPage() {
  const { user } = useAuth();
  const apiEnabled = hasFeature(user, "api");
  const webhooksEnabled = hasFeature(user, "webhooks");
  const [tab, setTab] = useState<Tab>(apiEnabled ? "api" : "webhooks");
  const supporting = isImpersonating(user);
  const readOnly = isReadOnlySupport(user?.impersonation);

  const available: { id: Tab; label: string }[] = [
    ...(apiEnabled ? [{ id: "api" as const, label: "API" }] : []),
    ...(webhooksEnabled ? [{ id: "webhooks" as const, label: "Webhooks" }] : []),
  ];
  const current = available.some((t) => t.id === tab) ? tab : available[0]?.id;

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Integrações</h1>
        <p className={styles.subtitle}>
          Conecte Instagram, WhatsApp, landing pages e outros sistemas ao CRM (via n8n ou direto).
        </p>
      </header>

      {available.length === 0 ? (
        <p className={styles.empty}>
          API e webhooks não estão contratados para esta organização. Fale com a GSM para ativar.
        </p>
      ) : (
        <>
          <div className={styles.tabs} role="tablist">
            {available.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={current === t.id}
                className={`${styles.tab} ${current === t.id ? styles.tabActive : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {current === "api" && <ApiCredentialsTab canManageSecrets={!supporting} />}
          {current === "webhooks" && (
            <WebhooksTab canWrite={!readOnly} canManageSecrets={!supporting} />
          )}
        </>
      )}
    </div>
  );
}
