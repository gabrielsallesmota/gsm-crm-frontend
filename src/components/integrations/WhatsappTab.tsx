import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { ROUTES } from "../../constants/routes";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useToast } from "../../hooks/useToast";
import { whatsappService } from "../../services/MessagingService";
import { describeWhatsapp, POLL_MS, shouldPollQr, type WhatsappConnection } from "../../utils/messaging";
import { formatDateTime } from "../../utils/datetime";
import styles from "./Integrations.module.css";

/**
 * Configurações → Integrações → WhatsApp (só Admin). A empresa conecta o número dela lendo um QR
 * Code; as conversas aparecem em "Conversas" e cada contato novo vira lead na fila. O CRM só
 * RESPONDE conversas — sem disparos, campanhas ou robôs.
 */
export function WhatsappTab({ readOnly }: { readOnly: boolean }) {
  const { data, loading, error, reload } = useAsyncResource(() => whatsappService.status(), []);
  const { toast, toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [qr, setQr] = useState<{ code: string | null; pairing: string | null } | null>(null);
  const [live, setLive] = useState<WhatsappConnection | null>(null);

  const connection = live ?? data?.connection ?? null;
  const polling = shouldPollQr(connection, qr !== null);

  // Com o QR na tela, pergunta o status a cada 3 s até o celular conectar.
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      whatsappService
        .status()
        .then((s) => {
          setLive(s.connection);
          if (s.connection?.status === "connected") {
            setQr(null);
            toast("WhatsApp conectado. As novas conversas já aparecem em Conversas.");
          }
        })
        .catch(() => undefined); // tenta de novo no próximo ciclo
    }, POLL_MS.qr);
    return () => window.clearInterval(timer);
  }, [polling, toast]);

  async function connect() {
    setBusy(true);
    try {
      const result = await whatsappService.connect();
      setLive(result.connection);
      if (result.connection.status === "connected") {
        setQr(null);
        toast("Este WhatsApp já está conectado.");
      } else {
        setQr({ code: result.qrCode, pairing: result.pairingCode });
      }
    } catch (err) {
      toastError(err, "Não foi possível gerar o QR Code.");
      // O backend guarda o erro na conexão: a tela mostra a situação real, não a anterior.
      setLive(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(): Promise<boolean> {
    try {
      const { notice } = await whatsappService.disconnect();
      setQr(null);
      setLive(null);
      toast(notice ?? "WhatsApp desconectado. O histórico das conversas continua no CRM.");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível desconectar.");
      return false;
    }
  }

  if (loading && !data) return <SkeletonRows rows={3} label="Carregando o WhatsApp" />;
  if (error) {
    return (
      <EmptyState title="Não foi possível carregar" message={error.message} action={{ label: "Tentar de novo", onClick: reload }} />
    );
  }
  if (!data) return null;
  const state = describeWhatsapp(connection);
  const connected = connection?.status === "connected";

  return (
    <section className={styles.panel} aria-label="WhatsApp">
      <h2 className={styles.panelTitle}>WhatsApp da empresa</h2>
      <p className={styles.intro}>
        Conecte o número comercial da empresa. As mensagens recebidas aparecem em <b>Conversas</b>, quem escrever pela
        primeira vez vira lead na fila e a equipe responde por aqui. O CRM não faz disparos, campanhas nem respostas
        automáticas.
      </p>
      <p className={styles.warning}>
        Esta conexão usa o WhatsApp Web (integração não oficial). O WhatsApp pode limitar ou bloquear números que tenham
        comportamento de envio em massa — use para atender clientes, não para prospectar.
      </p>

      {!data.configured && (
        <p className={styles.warning}>A integração com o WhatsApp ainda não está ativa neste ambiente. Fale com a GSM.</p>
      )}

      {data.configured && (
        <>
          <dl className={styles.dl}>
            <dt>Situação</dt>
            <dd>
              <span className={`${styles.pill} ${styles[state.tone]}`}>{state.label}</span>
            </dd>
            {connection?.phone && (
              <>
                <dt>Número</dt>
                <dd>
                  {connection.phone}
                  {connection.displayName ? ` · ${connection.displayName}` : ""}
                </dd>
              </>
            )}
            {connection?.lastConnectedAt && (
              <>
                <dt>Última conexão</dt>
                <dd>{formatDateTime(connection.lastConnectedAt)}</dd>
              </>
            )}
          </dl>
          {connection?.error && <p className={styles.warning}>{connection.error}</p>}

          {qr && !connected && (
            <div className={styles.qrBox} aria-live="polite">
              {qr.code ? (
                <img className={styles.qrImage} src={qr.code} alt="QR Code para conectar o WhatsApp" />
              ) : (
                <p className={styles.muted}>O QR Code ainda não ficou pronto. Clique em “Gerar novo QR Code”.</p>
              )}
              <ol className={styles.qrSteps}>
                <li>Abra o WhatsApp no celular da empresa.</li>
                <li>
                  Toque em <b>Mais opções</b> ou <b>Configurações</b> → <b>Dispositivos conectados</b> →{" "}
                  <b>Conectar um dispositivo</b>.
                </li>
                <li>Aponte a câmera para este QR Code. A tela atualiza sozinha.</li>
              </ol>
              {qr.pairing && (
                <p className={styles.muted}>
                  Ou conecte com o código: <span className={styles.mono}>{qr.pairing}</span>
                </p>
              )}
            </div>
          )}

          <div className={styles.rowActions}>
            {!connected && (
              <Button variant="primary" onClick={() => void connect()} disabled={busy || readOnly}>
                {busy ? "Gerando…" : qr ? "Gerar novo QR Code" : connection ? "Reconectar" : "Conectar WhatsApp"}
              </Button>
            )}
            {connected && (
              <Link className={styles.linkButton} to={ROUTES.conversas}>
                Abrir Conversas
              </Link>
            )}
            {connection && connection.status !== "disconnected" && (
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={readOnly}>
                Desconectar
              </Button>
            )}
          </div>
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title="Desconectar o WhatsApp"
          message="O CRM para de receber e enviar mensagens por este número. O histórico e os leads continuam no CRM; para voltar, é só reconectar."
          confirmLabel="Desconectar"
          onConfirm={disconnect}
          onClose={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
