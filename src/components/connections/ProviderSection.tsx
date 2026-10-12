import { useState } from "react";
import { Button } from "../common/Button";
import { ConnectionCard } from "./ConnectionCard";
import { ProviderLogo } from "./ProviderLogo";
import { useToast } from "../../hooks/useToast";
import { connectionsService } from "../../services/ConnectionsService";
import {
  describeConnectionError,
  FEATURE_LABEL,
  PROVIDER_LABEL,
  PROVIDER_SERVICES,
  reconnectFeatures,
  rememberPendingProvider,
  stateFromAuthorizationUrl,
} from "../../utils/connections";
import type {
  Connection,
  ConnectionFeature,
  ProviderId,
  ProviderInfo,
} from "../../types/connections";
import styles from "./Connections.module.css";

/** Um provedor: estado no ambiente/empresa, “Conectar conta” e as contas do
 * usuário. O navegador só segue a URL de consentimento devolvida pelo
 * backend (state e PKCE ficam presos à sessão no servidor). */
export function ProviderSection({
  info,
  connections,
  readOnly,
  onChanged,
  onRemoved,
  redirect = (url: string) => window.location.assign(url),
}: {
  info: ProviderInfo;
  connections: Connection[];
  readOnly: boolean;
  onChanged: (c: Connection) => void;
  onRemoved: (id: string) => void;
  redirect?: (url: string) => void;
}) {
  const { toast } = useToast();
  const [wanted, setWanted] = useState<ConnectionFeature[]>(["calendar", "tasks"]);
  const [starting, setStarting] = useState(false);
  const label = PROVIDER_LABEL[info.provider];
  const blocked = !info.configured ? "unconfigured" : !info.allowed ? "blocked" : null;

  async function start(provider: ProviderId, features: ConnectionFeature[]) {
    if (features.length === 0) return;
    setStarting(true);
    try {
      const url = await connectionsService.authorize(provider, features);
      if (!url) throw new Error("O servidor não devolveu o endereço de autorização.");
      const state = stateFromAuthorizationUrl(url);
      if (state) rememberPendingProvider(state, provider);
      redirect(url);
    } catch (err) {
      toast(describeConnectionError(err, `Não foi possível iniciar a conexão com ${label}.`), "error");
      setStarting(false);
    }
  }

  function toggle(feature: ConnectionFeature) {
    setWanted((cur) => (cur.includes(feature) ? cur.filter((f) => f !== feature) : [...cur, feature]));
  }

  return (
    <section className={styles.section} aria-labelledby={`prov-${info.provider}`}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={`prov-${info.provider}`} className={`${styles.sectionTitle} ${styles.providerTitle}`}>
            <ProviderLogo provider={info.provider} />
            {label}
          </h2>
          <p className={styles.muted}>{PROVIDER_SERVICES[info.provider]}</p>
        </div>
      </div>

      {blocked === "unconfigured" && (
        <p className={`${styles.alert} ${styles.alertWarn}`} role="status">
          A integração com {label} ainda não foi configurada neste ambiente. Fale com a GSM.
        </p>
      )}
      {blocked === "blocked" && (
        <p className={`${styles.alert} ${styles.alertWarn}`} role="status">
          A sua empresa não permite conexões com {label}. Peça a um administrador para liberar.
        </p>
      )}

      {!blocked && (
        <>
          <fieldset className={styles.toggles} disabled={readOnly || starting}>
            <legend>O que conectar</legend>
            {(["calendar", "tasks"] as const)
              .filter((f) => info.features.length === 0 || info.features.includes(f))
              .map((f) => (
                <label key={f} className={styles.check}>
                  <input type="checkbox" checked={wanted.includes(f)} onChange={() => toggle(f)} />
                  {FEATURE_LABEL[f]}
                </label>
              ))}
          </fieldset>
          <p className={styles.muted}>
            O CRM pede acesso somente a agenda e tarefas — nunca ao seu e-mail.
          </p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={readOnly || starting || wanted.length === 0}
              onClick={() => void start(info.provider, wanted)}
            >
              {starting ? "Redirecionando…" : connections.length ? "Conectar outra conta" : "Conectar conta"}
            </Button>
          </div>
        </>
      )}

      {connections.map((c) => (
        <ConnectionCard
          key={c.id}
          connection={c}
          readOnly={readOnly}
          onChanged={onChanged}
          onRemoved={onRemoved}
          onReconnect={(conn) => void start(conn.provider, reconnectFeatures(conn))}
        />
      ))}
      {connections.length === 0 && !blocked && (
        <p className={styles.muted}>Nenhuma conta {label} conectada.</p>
      )}
    </section>
  );
}
