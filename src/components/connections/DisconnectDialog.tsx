import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import form from "../common/Form.module.css";
import styles from "./Connections.module.css";

/**
 * Desconectar uma conta. Nada é apagado no provedor. Por padrão o que já foi
 * importado continua no CRM; marcar a opção remove SÓ as cópias importadas
 * daqui (o que o CRM criou no provedor nunca é limpo).
 */
export function DisconnectDialog({
  account,
  provider,
  onConfirm,
  onClose,
}: {
  account: string;
  provider: string;
  onConfirm: (purgeImported: boolean) => Promise<boolean>;
  onClose: () => void;
}) {
  const [purge, setPurge] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const ok = await onConfirm(purge);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title="Desconectar esta conta?" onClose={busy ? () => undefined : onClose}>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
        O CRM deixa de sincronizar com {account} e apaga os acessos guardados. Nada é apagado no{" "}
        {provider}.
      </p>
      <label className={styles.check} style={{ marginTop: 10 }}>
        <input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} />
        Remover também os compromissos e tarefas importados desta conta
      </label>
      <div className={form.actions}>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
          {busy ? "Aguarde…" : "Desconectar"}
        </Button>
      </div>
    </Modal>
  );
}
