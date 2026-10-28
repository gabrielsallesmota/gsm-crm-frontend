import { useState } from "react";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useToast } from "../../hooks/useToast";
import { describeInstagram, instagramService } from "../../services/InstagramService";
import { formatDateTime } from "../../utils/datetime";
import styles from "./Integrations.module.css";

/**
 * Configurações → Integrações → Instagram (só Admin). A empresa conecta a conta PROFISSIONAL dela
 * pelo login oficial do Instagram; os Directs aparecem em "Conversas", cada contato novo vira lead e
 * a equipe responde dentro da janela de 24 h da Meta.
 */
export function InstagramTab({ readOnly }: { readOnly: boolean }) {
  const { data, loading, error, reload } = useAsyncResource(() => instagramService.status(), []);
  const { toast, toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      window.location.assign(await instagramService.authorize());
    } catch (err) {
      toastError(err, "Não foi possível iniciar a conexão com o Instagram.");
      setBusy(false);
    }
  }

  async function disconnect(): Promise<boolean> {
    try {
      await instagramService.disconnect();
      toast("Instagram desconectado. Os leads já criados continuam no CRM.");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível desconectar.");
      return false;
    }
  }

  if (loading && !data) return <SkeletonRows rows={3} label="Carregando o Instagram" />;
  if (error) {
    return (
      <EmptyState title="Não foi possível carregar" message={error.message} action={{ label: "Tentar de novo", onClick: reload }} />
    );
  }
  if (!data) return null;
  const account = data.account;
  const state = account ? describeInstagram(account) : null;

  return (
    <section className={styles.panel} aria-label="Instagram">
      <h2 className={styles.panelTitle}>Instagram Direct → Lead</h2>
      <p className={styles.intro}>
        Os Directs da conta profissional da empresa aparecem em <b>Conversas</b>. Quem escrever pela primeira vez vira
        lead na fila (quem já é lead não gera outro) e a equipe responde por aqui — o Instagram só permite responder até
        24 h depois da última mensagem do cliente.
      </p>

      {!data.configured && (
        <p className={styles.warning}>A integração com o Instagram ainda não está ativa neste ambiente. Fale com a GSM.</p>
      )}

      {data.configured && !account && (
        <>
          <p className={styles.muted}>
            Precisa ser uma conta <b>profissional</b> (Empresa ou Criador de conteúdo). Conta pessoal não conecta.
          </p>
          <Button variant="primary" onClick={() => void connect()} disabled={busy || readOnly}>
            {busy ? "Abrindo o Instagram…" : "Conectar Instagram"}
          </Button>
        </>
      )}

      {account && state && (
        <>
          <dl className={styles.dl}>
            <dt>Conta</dt>
            <dd>@{account.username ?? "—"}</dd>
            <dt>Situação</dt>
            <dd><span className={`${styles.pill} ${styles[state.tone]}`}>{state.label}</span></dd>
            <dt>Último Direct recebido</dt>
            <dd>{account.lastWebhookAt ? formatDateTime(account.lastWebhookAt) : "nenhum ainda"}</dd>
            <dt>Autorização válida até</dt>
            <dd>{account.tokenExpiresAt ? `${formatDateTime(account.tokenExpiresAt)} (renovada sozinha)` : "—"}</dd>
          </dl>
          {account.error && <p className={styles.warning}>{account.error}</p>}
          <div className={styles.rowActions}>
            {(account.status === "needs_reconnect" || !account.receiving) && (
              <Button variant="primary" onClick={() => void connect()} disabled={busy || readOnly}>
                Conectar de novo
              </Button>
            )}
            <Button variant="danger" onClick={() => setConfirming(true)} disabled={readOnly}>
              Desconectar
            </Button>
          </div>
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title="Desconectar o Instagram"
          message="Novos Directs deixam de chegar ao CRM e não dá mais para responder por aqui. O histórico e os leads continuam no CRM."
          confirmLabel="Desconectar"
          onConfirm={disconnect}
          onClose={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
