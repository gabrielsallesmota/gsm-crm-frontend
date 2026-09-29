import { useState, type ReactNode } from "react";
import { Modal } from "../components/common/Modal";
import { Button } from "../components/common/Button";
import form from "../components/common/Form.module.css";

/** Ação do control plane que EXIGE motivo (suspender, iniciar/elevar
 * suporte). O motivo vai para a auditoria. */
export function ReasonDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  extra,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  extra?: ReactNode;
  onConfirm: (reason: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={title} onClose={busy ? () => undefined : onClose}>
      <form className={form.form} onSubmit={(e) => void submit(e)}>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{message}</div>
        <label className={form.field}>
          <span className={form.label}>Motivo (fica registrado na auditoria)</span>
          <textarea
            className={form.textarea}
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </label>
        {extra}
        <div className={form.actions}>
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={!valid || busy}>
            {busy ? "Aguarde…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
