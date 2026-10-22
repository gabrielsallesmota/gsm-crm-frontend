import { useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import form from "../common/Form.module.css";

/**
 * "Vincular a você?" — aparece quando alguém tira um lead SEM dono da primeira etapa (arrastar,
 * seletor do cartão ou da ficha). "Vincular a mim" assume e move; "Agora não" só move (o lead
 * continua na fila do nicho); fechar cancela a movimentação. Cada ação devolve `true` quando
 * terminou (o diálogo fecha).
 */
export function ClaimLeadDialog({
  leadName,
  nicheName,
  stageLabel,
  onClaim,
  onSkip,
  onClose,
}: {
  leadName: string;
  nicheName: string | null;
  stageLabel: string;
  onClaim: () => Promise<boolean>;
  onSkip: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<"claim" | "skip" | null>(null);

  async function run(kind: "claim" | "skip") {
    setBusy(kind);
    const done = await (kind === "claim" ? onClaim() : onSkip());
    setBusy(null);
    if (done) onClose();
  }

  return (
    <Modal
      title="Vincular a você?"
      subtitle={`"${leadName}" ainda não tem responsável${nicheName ? ` (nicho ${nicheName})` : ""}. Ele vai para "${stageLabel}".`}
      onClose={onClose}
    >
      <p className={form.hint}>
        Ao vincular, o lead passa a ser seu e sai da fila dos outros vendedores do nicho.
      </p>
      <div className={form.actions}>
        <Button onClick={() => void run("skip")} disabled={busy !== null}>
          {busy === "skip" ? "Movendo…" : "Agora não"}
        </Button>
        <Button variant="primary" onClick={() => void run("claim")} disabled={busy !== null} autoFocus>
          {busy === "claim" ? "Vinculando…" : "Vincular a mim"}
        </Button>
      </div>
    </Modal>
  );
}
