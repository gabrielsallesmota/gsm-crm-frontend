import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import form from "./Form.module.css";

/**
 * Confirmação de ação destrutiva (excluir tarefa/compromisso/lead...). O
 * botão fica ocupado durante a chamada — clique duplo não dispara duas
 * exclusões. Erro: quem chama trata (toast) e o diálogo continua aberto.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Excluir",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function handleConfirm() {
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <Modal title={title} onClose={busy ? () => undefined : onClose}>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>{message}</p>
      <div className={form.actions}>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={() => void handleConfirm()} disabled={busy}>
          {busy ? "Aguarde…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
