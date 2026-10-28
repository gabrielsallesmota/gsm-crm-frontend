import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { ROUTES } from "../constants/routes";
import { describeConnectionError, isUsableOAuthReturn, parseOAuthReturn } from "../utils/connections";
import { instagramService, type InstagramAccount } from "../services/InstagramService";
import { SkeletonRows } from "../components/common/Skeleton";
import styles from "../components/integrations/Integrations.module.css";

type View = { kind: "working" } | { kind: "done"; account: InstagramAccount } | { kind: "error"; message: string };

/** `state` é de uso único: StrictMode monta o efeito duas vezes; guardamos o que já foi tratado. */
const handled = new Map<string, Promise<View>>();

/**
 * Retorno do login do Instagram: `/configuracoes/integracoes/instagram/callback?code=&state=`. Entrega
 * ao backend (que valida o `state` preso a esta sessão e troca o código) e tira código e state da URL.
 */
export function InstagramCallbackPage() {
  usePageTitle("Conectando o Instagram");
  const { search } = useLocation();
  const [view, setView] = useState<View>({ kind: "working" });

  useEffect(() => {
    let alive = true;
    const ret = parseOAuthReturn(search);
    if (!isUsableOAuthReturn(ret) || !ret.state) {
      setView({ kind: "error", message: "Este endereço não é um retorno válido do Instagram. Conecte de novo." });
      return;
    }
    let job = handled.get(ret.state);
    if (!job) {
      job = instagramService
        .complete({ state: ret.state, ...(ret.code ? { code: ret.code } : {}), ...(ret.error ? { error: ret.error } : {}) })
        .then((account): View => ({ kind: "done", account }))
        .catch((err: unknown): View => ({ kind: "error", message: describeConnectionError(err, "Não foi possível conectar o Instagram.") }));
      handled.set(ret.state, job);
    }
    window.history.replaceState(null, "", window.location.pathname);
    void job.then((v) => alive && setView(v));
    return () => {
      alive = false;
    };
  }, [search]);

  return (
    <section className={styles.panel} aria-live="polite">
      <h1 className={styles.title}>Instagram</h1>
      {view.kind === "working" && <SkeletonRows rows={2} label="Conectando o Instagram" />}
      {view.kind === "done" && (
        <p>
          Conta <b>@{view.account.username ?? "—"}</b> conectada.{" "}
          {view.account.receiving
            ? "A partir de agora, o primeiro Direct de cada pessoa vira lead."
            : "Mas o recebimento de Directs não foi ativado — tente conectar de novo."}
        </p>
      )}
      {view.kind === "error" && <p className={styles.warning}>{view.message}</p>}
      {view.kind !== "working" && <Link to={`${ROUTES.integracoes}?aba=instagram`}>Voltar para Integrações</Link>}
    </section>
  );
}
