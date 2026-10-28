import { useState } from "react";
import { Button } from "../common/Button";
import { DisconnectDialog } from "./DisconnectDialog";
import { SelectionModal } from "./SelectionModal";
import { SyncHistory } from "./SyncHistory";
import { useToast } from "../../hooks/useToast";
import { connectionsService } from "../../services/ConnectionsService";
import { formatDateTime } from "../../utils/datetime";
import {
  canSyncNow,
  describeConnectionError,
  connectionAttention,
  FEATURE_LABEL,
  isCalendarOnly,
  PROVIDER_LABEL,
  SYNC_STATUS_LABEL,
} from "../../utils/connections";
import type { Connection, ConnectionPatch } from "../../types/connections";
import styles from "./Connections.module.css";

/** Uma conta conectada: estado, preferências, seleção, sincronização e
 * desconexão. Nunca exibe token nem dado de outra pessoa. */
export function ConnectionCard({
  connection,
  readOnly,
  onChanged,
  onRemoved,
  onReconnect,
}: {
  connection: Connection;
  /** Sessão de suporte: só consulta. */
  readOnly: boolean;
  onChanged: (c: Connection) => void;
  onRemoved: (id: string) => void;
  onReconnect: (c: Connection) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const calendarOnly = isCalendarOnly(connection.provider);

  const attention = connectionAttention(connection);
  const provider = PROVIDER_LABEL[connection.provider];
  const chip = connection.needsReconnect
    ? { cls: styles.chipBad, text: "Reconexão necessária" }
    : connection.syncStatus === "failed"
      ? { cls: styles.chipWarn, text: SYNC_STATUS_LABEL.failed }
      : { cls: styles.chipOk, text: SYNC_STATUS_LABEL[connection.syncStatus] };

  async function patch(change: ConnectionPatch, message: string) {
    setBusy(true);
    try {
      onChanged(await connectionsService.update(connection.id, change));
      toast(message);
    } catch (err) {
      toast(describeConnectionError(err, "Não foi possível salvar a alteração."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      onChanged(await connectionsService.syncNow(connection.id));
      toast("Sincronização solicitada. Os itens aparecem na Agenda e em Tarefas em instantes.");
    } catch (err) {
      toast(describeConnectionError(err, "Não foi possível solicitar a sincronização."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(purge: boolean): Promise<boolean> {
    try {
      const result = await connectionsService.disconnect(connection.id, purge);
      onRemoved(connection.id);
      toast(
        result.providerRevoked === false
          ? connection.provider === "apple"
            ? "Conexão removida. Apague também a senha de app “GSM CRM” em account.apple.com."
            : "Conexão removida. Revogue o acesso também nas configurações da conta do provedor."
          : "Conta desconectada.",
      );
      return true;
    } catch (err) {
      toast(describeConnectionError(err, "Não foi possível desconectar."), "error");
      return false;
    }
  }

  const selectedSummary = [
    connection.calendarEnabled
      ? `${connection.selectedCalendars.length} calendário(s)`
      : null,
    connection.tasksEnabled ? `${connection.selectedTaskLists.length} lista(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={styles.card} aria-label={`Conta ${provider}: ${connection.accountEmail ?? ""}`}>
      <div className={styles.cardHead}>
        <span className={styles.account}>{connection.accountEmail ?? `Conta ${provider}`}</span>
        <span className={`${styles.chip} ${chip.cls}`}>{chip.text}</span>
      </div>

      {attention && (
        <p className={`${styles.alert} ${connection.needsReconnect ? styles.alertBad : styles.alertWarn}`} role="alert">
          {attention}
        </p>
      )}

      <dl className={styles.facts}>
        <div>
          <dt>Última sincronização com sucesso</dt>
          <dd>{connection.lastSuccessAt ? formatDateTime(connection.lastSuccessAt) : "ainda não houve"}</dd>
        </div>
        <div>
          <dt>Sincronização automática</dt>
          <dd>
            {connection.automaticSyncEnabled
              ? `a cada ${connection.intervalMinutes} minutos`
              : "desligada"}
          </dd>
        </div>
        <div>
          <dt>Sincronizando</dt>
          <dd>{selectedSummary || "nada selecionado"}</dd>
        </div>
      </dl>

      <fieldset className={styles.toggles} disabled={readOnly || busy || connection.needsReconnect}>
        <legend>Preferências</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={connection.calendarEnabled}
            onChange={(e) =>
              void patch({ calendarEnabled: e.target.checked }, "Preferência salva.")
            }
          />
          {FEATURE_LABEL.calendar}
        </label>
        {!calendarOnly && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={connection.tasksEnabled}
              onChange={(e) => void patch({ tasksEnabled: e.target.checked }, "Preferência salva.")}
            />
            {FEATURE_LABEL.tasks}
          </label>
        )}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={connection.automaticSyncEnabled}
            onChange={(e) =>
              void patch({ automaticSyncEnabled: e.target.checked }, "Preferência salva.")
            }
          />
          Sincronizar automaticamente
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={connection.manualSyncEnabled}
            onChange={(e) =>
              void patch({ manualSyncEnabled: e.target.checked }, "Preferência salva.")
            }
          />
          Permitir “Sincronizar agora”
        </label>
      </fieldset>

      <div className={styles.actions}>
        {connection.needsReconnect ? (
          <Button variant="primary" disabled={readOnly} onClick={() => onReconnect(connection)}>
            Reconectar
          </Button>
        ) : (
          <>
            <Button disabled={readOnly || busy} onClick={() => setSelecting(true)}>
              {calendarOnly ? "Escolher calendários" : "Escolher calendários e listas"}
            </Button>
            <Button
              variant="primary"
              disabled={readOnly || busy || !canSyncNow(connection)}
              onClick={() => void syncNow()}
              title={
                canSyncNow(connection)
                  ? undefined
                  : "Escolha ao menos um calendário ou lista (e mantenha a sincronização manual ligada)."
              }
            >
              Sincronizar agora
            </Button>
          </>
        )}
        <Button onClick={() => setShowRuns((v) => !v)} aria-expanded={showRuns}>
          {showRuns ? "Ocultar histórico" : "Ver histórico"}
        </Button>
        <Button variant="danger" disabled={readOnly || busy} onClick={() => setDisconnecting(true)}>
          Desconectar
        </Button>
      </div>

      {showRuns && <SyncHistory connectionId={connection.id} />}

      {selecting && (
        <SelectionModal
          connection={connection}
          onClose={() => setSelecting(false)}
          onSaved={onChanged}
        />
      )}
      {disconnecting && (
        <DisconnectDialog
          account={connection.accountEmail ?? provider}
          provider={provider}
          onConfirm={disconnect}
          onClose={() => setDisconnecting(false)}
        />
      )}
    </article>
  );
}
