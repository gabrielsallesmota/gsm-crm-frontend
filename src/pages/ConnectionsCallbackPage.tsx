import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { connectionsService } from "../services/ConnectionsService";
import { ROUTES } from "../constants/routes";
import {
  describeConnectionError,
  FEATURE_LABEL,
  isUsableOAuthReturn,
  parseOAuthReturn,
  PROVIDER_LABEL,
  takePendingProvider,
} from "../utils/connections";
import type { CallbackResult, ProviderId } from "../types/connections";
import { SkeletonRows } from "../components/common/Skeleton";
import styles from "../components/integrations/Integrations.module.css";
import local from "../components/notifications/Notifications.module.css";

type View =
  | { kind: "working" }
  | { kind: "done"; result: CallbackResult }
  | { kind: "error"; message: string };

/** `state` é de uso único: o React (StrictMode) monta o efeito duas vezes e
 * um recarregamento reenviaria a mesma URL. Guardamos o que já foi tratado. */
const handled = new Map<string, Promise<View>>();

/**
 * Retorno do consentimento (CRM-003B.4/B.5): `/perfil/conexoes/callback`
 * recebe `?state=&code=` do provedor e entrega ao backend, que valida o
 * state preso à sessão e troca o código. O código nunca fica na URL depois
 * disso e nunca é guardado no navegador.
 */
export function ConnectionsCallbackPage() {
  usePageTitle("Conectando conta");
  const { search } = useLocation();
  const [view, setView] = useState<View>({ kind: "working" });
  const [provider, setProvider] = useState<ProviderId | null>(null);

  useEffect(() => {
    let alive = true;
    const ret = parseOAuthReturn(search);
    if (!isUsableOAuthReturn(ret) || !ret.state) {
      setView({
        kind: "error",
        message: "Este endereço não é um retorno de autorização válido. Inicie a conexão novamente.",
      });
      return;
    }
    const key = ret.state;
    let job = handled.get(key);
    if (!job) {
      const provider = takePendingProvider(ret.state);
      if (!provider) {
        setView({
          kind: "error",
          message:
            "Não foi possível identificar qual conta estava sendo conectada (a conexão deve terminar na mesma aba em que começou). Inicie a conexão novamente.",
        });
        return;
      }
      setProvider(provider);
      job = connectionsService
        .completeAuthorization(provider, {
          state: ret.state,
          ...(ret.code ? { code: ret.code } : {}),
          ...(ret.error ? { error: ret.error } : {}),
          ...(ret.errorDescription ? { errorDescription: ret.errorDescription } : {}),
        })
        .then((result): View => ({ kind: "done", result }))
        .catch(
          (err: unknown): View => ({
            kind: "error",
            message: describeConnectionError(err, "Não foi possível concluir a conexão."),
          }),
        );
      handled.set(key, job);
    }
    // Tira código/state da barra de endereço e do histórico.
    window.history.replaceState(null, "", window.location.pathname);
    void job.then((v) => alive && setView(v));
    return () => {
      alive = false;
    };
  }, [search]);

  const label = provider ? PROVIDER_LABEL[provider] : "da sua conta";

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Conectando {label.startsWith("da") ? label : `sua conta ${label}`}</h1>
      </header>
      {view.kind === "working" && <SkeletonRows rows={2} label="Concluindo a conexão" />}
      {view.kind === "error" && (
        <>
          <p className={`${local.notice} ${local.danger}`} role="alert">
            {view.message}
          </p>
          <p>
            <Link to={ROUTES.minhasConexoes}>Voltar às conexões</Link>
          </p>
        </>
      )}
      {view.kind === "done" && (
        <>
          <p className={`${local.notice} ${local.success}`} role="status">
            Conta {view.result.connection.accountEmail ?? label} conectada.
          </p>
          {view.result.missingFeatures.length > 0 && (
            <p className={`${local.notice} ${local.caution}`} role="alert">
              Você não liberou o acesso a{" "}
              {view.result.missingFeatures.map((f) => FEATURE_LABEL[f]).join(" e ")}. Essa parte
              ficou desligada; para usá-la, reconecte a conta marcando a permissão.
            </p>
          )}
          <p>
            Agora escolha quais calendários e listas sincronizar em{" "}
            <Link to={ROUTES.minhasConexoes}>Minhas conexões</Link>.
          </p>
        </>
      )}
    </div>
  );
}
